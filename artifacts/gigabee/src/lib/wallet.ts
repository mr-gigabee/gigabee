import type { Transaction } from "@solana/web3.js";

export interface SolanaWallet {
  isPhantom?: boolean;
  isSolflare?: boolean;
  publicKey: { toBase58(): string } | null;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{
    publicKey: { toBase58(): string };
  }>;
  signMessage(
    msg: Uint8Array,
  ): Promise<{ signature: Uint8Array } | Uint8Array>;
  signAndSendTransaction(
    tx: Transaction,
    opts?: { skipPreflight?: boolean; maxRetries?: number },
  ): Promise<{ signature: string }>;
}

declare global {
  interface Window {
    phantom?: { solana?: SolanaWallet };
    solana?: SolanaWallet;
    solflare?: SolanaWallet;
  }
}

export function detectWallet(): SolanaWallet | null {
  if (typeof window === "undefined") return null;
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
  if (window.solana?.isPhantom) return window.solana;
  if (window.solflare?.isSolflare) return window.solflare;
  return null;
}
