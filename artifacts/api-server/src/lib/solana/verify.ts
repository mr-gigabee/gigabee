import { Connection, PublicKey } from "@solana/web3.js";
import { logger } from "../logger";

export const TREASURY_WALLET = "4ojZUbahagMhCsnPgVqNmHWydfL5u97LYHG3ZjfZDouy";
export const GB_MINT = "7NcMKMrXPBVCWPcs9SSqnF6ZGy5neAtzTZpFqZqLquaP";
const GB_DECIMALS = 6;

function resolveRpcUrl(): string {
  const heliusKey = process.env["HELIUS_API_KEY"];
  if (heliusKey) return `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
  return process.env["SOLANA_RPC_URL"] ?? "https://api.mainnet-beta.solana.com";
}

const RPC_URL = resolveRpcUrl();

// ── Credit packages — fixed in USD, $GB amount calculated at runtime ─────────
export const CREDIT_PACKAGES: Record<
  string,
  { usdAmount: number; credits: number; label: string }
> = {
  starter:  { usdAmount: 5,  credits: 500,  label: "Starter"  },
  standard: { usdAmount: 10, credits: 1100, label: "Standard" },
  pro:      { usdAmount: 25, credits: 2750, label: "Pro"       },
  power:    { usdAmount: 50, credits: 6000, label: "Power"     },
};

// ── $GB live price via Jupiter API (60 second cache) ────────────────────────
let priceCache: { price: number; ts: number } | null = null;
const PRICE_TTL_MS = 60_000;

async function fetchFromJupiter(): Promise<number> {
  const res = await fetch(
    `https://api.jup.ag/price/v2?ids=${GB_MINT}`,
    { signal: AbortSignal.timeout(4000) },
  );
  if (!res.ok) throw new Error(`Jupiter API ${res.status}`);
  const body = await res.json() as { data?: Record<string, { price?: string }> };
  const rawPrice = body.data?.[GB_MINT]?.price;
  if (!rawPrice) throw new Error("Price missing from Jupiter");
  const price = parseFloat(rawPrice);
  if (!isFinite(price) || price <= 0) throw new Error(`Invalid Jupiter price: ${rawPrice}`);
  return price;
}

async function fetchFromDexScreener(): Promise<number> {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${GB_MINT}`,
    { signal: AbortSignal.timeout(4000) },
  );
  if (!res.ok) throw new Error(`DexScreener API ${res.status}`);
  const body = await res.json() as {
    pairs?: Array<{ priceUsd?: string; liquidity?: { usd?: number } }>;
  };
  const pairs = body.pairs ?? [];
  if (!pairs.length) throw new Error("No pairs on DexScreener");
  const sorted = [...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  const price = parseFloat(sorted[0]?.priceUsd ?? "0");
  if (!isFinite(price) || price <= 0) throw new Error("Invalid DexScreener price");
  return price;
}

export async function getGbPrice(): Promise<number> {
  const now = Date.now();
  if (priceCache && now - priceCache.ts < PRICE_TTL_MS) {
    return priceCache.price;
  }

  let price: number | null = null;

  try {
    price = await fetchFromJupiter();
    logger.info({ price, source: "jupiter" }, "$GB price refreshed");
  } catch (jupErr) {
    logger.warn({ err: jupErr }, "Jupiter price failed, trying DexScreener");
    try {
      price = await fetchFromDexScreener();
      logger.info({ price, source: "dexscreener" }, "$GB price refreshed");
    } catch (dexErr) {
      logger.warn({ err: dexErr }, "DexScreener price also failed");
    }
  }

  if (price !== null) {
    priceCache = { price, ts: now };
    return price;
  }

  if (priceCache) {
    logger.info({ price: priceCache.price }, "Using stale $GB price");
    return priceCache.price;
  }

  throw new Error("$GB price unavailable — please try again in a moment");
}

/**
 * Verifies that `txSignature` is a confirmed $GB token transfer worth at least
 * `expectedUsdAmount` USD (using live price, ±5% tolerance) to the treasury.
 * Returns the sender's wallet address on success.
 */
export async function verifyGbPayment(params: {
  txSignature: string;
  expectedUsdAmount: number;
}): Promise<
  | { ok: true; sender: string; blockTime: number | null; actualGbAmount: number }
  | { ok: false; reason: string }
> {
  // Fetch live price first
  let gbPrice: number;
  try {
    gbPrice = await getGbPrice();
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }

  // Minimum $GB required = (usdAmount / gbPrice) * 0.90  (10% tolerance for volatile tokens)
  const minGbAmount = (params.expectedUsdAmount / gbPrice) * 0.90;
  const minGbMicro  = Math.floor(minGbAmount * Math.pow(10, GB_DECIMALS));

  const connection = new Connection(RPC_URL, "confirmed");

  let tx;
  try {
    tx = await connection.getParsedTransaction(params.txSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
  } catch (err) {
    logger.warn({ err, txSignature: params.txSignature }, "RPC fetch failed");
    return { ok: false, reason: "Could not fetch transaction from Solana RPC" };
  }

  if (!tx || !tx.meta) {
    return { ok: false, reason: "Transaction not found or not yet confirmed" };
  }

  if (tx.meta.err) {
    return { ok: false, reason: "Transaction failed on-chain" };
  }

  const instructions =
    tx.transaction.message.instructions as Array<Record<string, unknown>>;

  let sender: string | null = null;
  let actualGbMicro = 0;

  for (const ix of instructions) {
    const parsed = ix["parsed"] as
      | { type: string; info: Record<string, unknown> }
      | undefined;
    if (!parsed) continue;

    if (
      parsed.type === "transferChecked" ||
      parsed.type === "transfer"
    ) {
      const info = parsed.info;
      const mint = info["mint"] as string | undefined;
      const dest = (info["destination"] as string | undefined);
      const amount = Number(
        (info["tokenAmount"] as { amount?: string } | undefined)?.amount ??
        info["amount"] ??
        0,
      );
      const authority = info["authority"] as string | undefined;

      if (mint !== GB_MINT) continue;

      const destWallet = await resolveTokenAccountOwner(connection, dest ?? "");
      if (
        destWallet?.toLowerCase() === TREASURY_WALLET.toLowerCase() &&
        amount >= minGbMicro
      ) {
        actualGbMicro = amount;
        sender = authority ?? (info["source"] as string | undefined) ?? null;
        if (sender) {
          const senderWallet = await resolveTokenAccountOwner(connection, sender);
          if (senderWallet) sender = senderWallet;
        }
      }
    }
  }

  if (!sender) {
    const expectedGb = (params.expectedUsdAmount / gbPrice).toFixed(4);
    return {
      ok: false,
      reason: `No matching $GB transfer of ≥${expectedGb} $GB (≈$${params.expectedUsdAmount} at current price) to treasury found in this transaction`,
    };
  }

  const actualGbAmount = actualGbMicro / Math.pow(10, GB_DECIMALS);
  return { ok: true, sender, blockTime: tx.blockTime ?? null, actualGbAmount };
}

async function resolveTokenAccountOwner(
  connection: Connection,
  address: string,
): Promise<string | null> {
  if (!address) return null;
  try {
    const pk = new PublicKey(address);
    const info = await connection.getParsedAccountInfo(pk);
    const data = (info.value?.data as { parsed?: { info?: { owner?: string } } } | undefined)
      ?.parsed?.info;
    return data?.owner ?? address;
  } catch {
    return address;
  }
}
