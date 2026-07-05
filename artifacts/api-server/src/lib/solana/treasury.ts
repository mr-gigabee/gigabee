import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";
import bs58 from "bs58";
import { TREASURY_WALLET, USDC_MINT } from "./verify";
import { logger } from "../logger";

const USDC_DECIMALS = 6;
const RPC_URL = process.env["SOLANA_RPC_URL"] ?? "https://api.mainnet-beta.solana.com";

function loadTreasuryKeypair(): Keypair {
  const raw = process.env["TREASURY_PRIVATE_KEY"];
  if (!raw) throw new Error("TREASURY_PRIVATE_KEY env var not set");

  const trimmed = raw.trim();
  let secretKey: Uint8Array;

  if (trimmed.startsWith("[")) {
    // JSON byte array: [1,2,3,...]
    const arr = JSON.parse(trimmed) as number[];
    secretKey = new Uint8Array(arr);
  } else {
    // Base58 string (Phantom export)
    secretKey = bs58.decode(trimmed);
  }

  const kp = Keypair.fromSecretKey(secretKey);

  if (kp.publicKey.toBase58() !== TREASURY_WALLET) {
    throw new Error(
      `Treasury keypair mismatch: key derives to ${kp.publicKey.toBase58()} but TREASURY_WALLET is ${TREASURY_WALLET}`,
    );
  }

  return kp;
}

export type TransferResult =
  | { ok: true; txHash: string }
  | { ok: false; reason: string };

/**
 * Sends USDC from the treasury wallet to a recipient Solana address.
 * Creates the recipient's USDC ATA if it doesn't exist (treasury pays rent).
 */
export async function sendUsdcFromTreasury(params: {
  recipientWallet: string;
  amountUsd: number;
}): Promise<TransferResult> {
  const { recipientWallet, amountUsd } = params;

  let keypair: Keypair;
  try {
    keypair = loadTreasuryKeypair();
  } catch (err) {
    logger.error({ err }, "Failed to load treasury keypair");
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Treasury keypair configuration error",
    };
  }

  let recipient: PublicKey;
  try {
    recipient = new PublicKey(recipientWallet);
  } catch {
    return { ok: false, reason: `Invalid Solana wallet address: ${recipientWallet}` };
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const usdcMint = new PublicKey(USDC_MINT);
  const amountRaw = BigInt(Math.round(amountUsd * Math.pow(10, USDC_DECIMALS)));

  try {
    // Get treasury's USDC associated token account
    const treasuryAta = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      usdcMint,
      keypair.publicKey,
    );

    // Get or create recipient's USDC ATA (treasury pays rent for new accounts)
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      usdcMint,
      recipient,
    );

    const signature = await transfer(
      connection,
      keypair,
      treasuryAta.address,
      recipientAta.address,
      keypair,
      amountRaw,
    );

    logger.info({ signature, recipientWallet, amountUsd }, "USDC payout sent from treasury");
    return { ok: true, txHash: signature };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, recipientWallet, amountUsd }, "USDC transfer failed");
    return { ok: false, reason: msg };
  }
}

/** Validates that the treasury keypair loads correctly without transferring. */
export function validateTreasuryKey(): { ok: true } | { ok: false; reason: string } {
  try {
    loadTreasuryKeypair();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Unknown error" };
  }
}
