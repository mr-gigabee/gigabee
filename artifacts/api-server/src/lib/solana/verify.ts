import { Connection, PublicKey } from "@solana/web3.js";
import { logger } from "../logger";

export const TREASURY_WALLET = "4ojZUbahagMhCsnPgVqNmHWydfL5u97LYHG3ZjfZDouy";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;

function resolveRpcUrl(): string {
  const heliusKey = process.env["HELIUS_API_KEY"];
  if (heliusKey) return `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
  return process.env["SOLANA_RPC_URL"] ?? "https://api.mainnet-beta.solana.com";
}

const RPC_URL = resolveRpcUrl();

export const CREDIT_PACKAGES: Record<
  string,
  { usdcAmount: number; credits: number; label: string }
> = {
  starter:  { usdcAmount: 5,  credits: 500,  label: "Starter"  },
  standard: { usdcAmount: 10, credits: 1100, label: "Standard" },
  pro:      { usdcAmount: 25, credits: 2750, label: "Pro"       },
  power:    { usdcAmount: 50, credits: 6000, label: "Power"     },
};

/**
 * Verifies that `txSignature` is a confirmed USDC transfer of `expectedUsdc`
 * to the treasury wallet on Solana mainnet.
 * Returns the sender's wallet address on success.
 */
export async function verifyUsdcPayment(params: {
  txSignature: string;
  expectedUsdcAmount: number; // e.g. 5 for $5
}): Promise<{ ok: true; sender: string; blockTime: number | null } | { ok: false; reason: string }> {
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

  const expectedMicro = params.expectedUsdcAmount * Math.pow(10, USDC_DECIMALS);

  const instructions =
    tx.transaction.message.instructions as Array<Record<string, unknown>>;

  let sender: string | null = null;

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
      const dest = (info["destination"] as string | undefined) ??
                   (info["tokenAmount"] ? undefined : undefined);
      const amount = Number(
        (info["tokenAmount"] as { amount?: string } | undefined)?.amount ??
        info["amount"] ??
        0,
      );
      const authority = info["authority"] as string | undefined;

      if (mint !== USDC_MINT) continue;

      // Resolve dest to wallet (associated token account → owner)
      const destWallet = await resolveTokenAccountOwner(connection, dest ?? "");
      if (
        destWallet?.toLowerCase() === TREASURY_WALLET.toLowerCase() &&
        amount === expectedMicro
      ) {
        sender = authority ?? (info["source"] as string | undefined) ?? null;
        if (sender) {
          const senderWallet = await resolveTokenAccountOwner(connection, sender);
          if (senderWallet) sender = senderWallet;
        }
      }
    }
  }

  if (!sender) {
    return {
      ok: false,
      reason: `No matching USDC transfer of $${params.expectedUsdcAmount} to treasury found in this transaction`,
    };
  }

  return { ok: true, sender, blockTime: tx.blockTime ?? null };
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
