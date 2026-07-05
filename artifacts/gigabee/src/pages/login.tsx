import { useState } from "react";
import { Link, useLocation } from "wouter";
import { BeeLogo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet, Download } from "lucide-react";
import { setSessionToken } from "@/lib/socket";
import { type SolanaWallet, detectWallet } from "@/lib/wallet";

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

export default function Login() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noWallet, setNoWallet] = useState(false);

  async function handleConnect() {
    setError(null);
    setNoWallet(false);

    const wallet = detectWallet();

    if (!wallet) {
      setNoWallet(true);
      return;
    }

    setLoading(true);
    try {
      // 1. Connect and get public key
      const { publicKey } = await wallet.connect();
      const address = publicKey.toBase58();

      // 2. Build and sign a timestamped message
      const timestamp = Date.now();
      const message = new TextEncoder().encode(`Sign in to Gigabee\nTimestamp: ${timestamp}`);
      const raw = await wallet.signMessage(message);

      // Phantom wraps in { signature }, Solflare returns the Uint8Array directly
      const sigBytes = raw instanceof Uint8Array ? raw : (raw as { signature: Uint8Array }).signature;
      const signature = toBase64(sigBytes);

      // 3. Exchange with our backend for a session token
      const res = await fetch("/api/auth/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, timestamp }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Auth failed");
      }

      const { sessionToken } = await res.json() as { sessionToken: string };
      setSessionToken(sessionToken);
      window.dispatchEvent(new Event("storage"));

      const pendingRef = localStorage.getItem("gigabee_ref");
      if (pendingRef) {
        localStorage.removeItem("gigabee_ref");
        fetch("/api/auth/claim-referral", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ referralCode: pendingRef }),
        }).catch(() => undefined);
      }

      navigate("/chat");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      // User rejected the request, don't show an error
      if (msg.toLowerCase().includes("user rejected") || msg.toLowerCase().includes("cancelled")) {
        setLoading(false);
        return;
      }
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="login-page">
      <div className="p-4">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" data-testid="btn-back-home">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-10">
            <BeeLogo className="h-10 w-10 mb-4" />
            <h1 className="text-2xl font-medium text-foreground mb-1">Welcome to Gigabee</h1>
            <p className="text-sm text-muted-foreground text-center">
              Connect your Solana wallet to start chatting or access your Hive earnings.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center mb-4">{error}</p>
          )}

          {noWallet ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                No Solana wallet detected. Install one of:
              </p>
              <a href="https://phantom.app" target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full gap-3 h-11">
                  <Download className="h-4 w-4" />
                  Install Phantom
                </Button>
              </a>
              <a href="https://solflare.com" target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full gap-3 h-11">
                  <Download className="h-4 w-4" />
                  Install Solflare
                </Button>
              </a>
            </div>
          ) : (
            <Button
              className="w-full gap-3 h-11"
              onClick={handleConnect}
              disabled={loading}
              data-testid="btn-wallet-login"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-background" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
              {loading ? "Connecting…" : "Connect Solana Wallet"}
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center mt-8">
            No password required. No KYC to sign up or chat.{" "}
            <Link href="/docs">
              <span className="text-primary hover:underline cursor-pointer">Privacy policy</span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
