import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { getSessionToken } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCreditsBalanceQueryKey } from "@workspace/api-client-react";

const TREASURY_WALLET = "4ojZUbahagMhCsnPgVqNmHWydfL5u97LYHG3ZjfZDouy";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface CreditPackage {
  id: string;
  label: string;
  usdcAmount: number;
  credits: number;
  bonus: number;
  pricePerCredit: string;
}

type Step = "packages" | "send" | "verifying" | "success" | "error";

interface Props {
  open: boolean;
  onClose: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className="shrink-0 p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function BuyCreditsModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [selected, setSelected] = useState<CreditPackage | null>(null);
  const [step, setStep] = useState<Step>("packages");
  const [txInput, setTxInput] = useState("");
  const [creditsAdded, setCreditsAdded] = useState(0);
  const [error, setError] = useState("");
  const [loadingPkgs, setLoadingPkgs] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoadingPkgs(true);
    fetch("/api/credits/packages")
      .then((r) => r.json())
      .then((d: { packages: CreditPackage[] }) => setPackages(d.packages))
      .catch(() => setError("Failed to load packages"))
      .finally(() => setLoadingPkgs(false));
  }, [open]);

  const reset = useCallback(() => {
    setStep("packages");
    setSelected(null);
    setError("");
    setTxInput("");
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  function extractSig(raw: string): string {
    const trimmed = raw.trim();
    const match = trimmed.match(/\/tx\/([A-Za-z0-9]{60,})/);
    return match ? match[1] : trimmed;
  }

  async function handleVerify() {
    if (!selected || !txInput.trim()) return;
    const sig = extractSig(txInput);
    setTxInput(sig);
    setStep("verifying");
    setError("");
    try {
      const token = getSessionToken();
      const res = await fetch("/api/credits/verify-tx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          txSignature: sig,
          packageId: selected.id,
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        credits?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Verification failed");
      setCreditsAdded(body.credits ?? selected.credits);
      setStep("success");
      await queryClient.invalidateQueries({
        queryKey: getGetCreditsBalanceQueryKey(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStep("error");
    }
  }

  const shortWallet = `${TREASURY_WALLET.slice(0, 6)}...${TREASURY_WALLET.slice(-6)}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Buy Credits</DialogTitle>
        </DialogHeader>

        {/* Step 1: Pick package */}
        {step === "packages" && (
          <div className="space-y-4">
            {loadingPkgs ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  1 credit = $0.01. Pay with USDC on Solana mainnet.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {packages.map((pkg) => (
                    <button
                      key={pkg.id}
                      onClick={() => setSelected(pkg)}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        selected?.id === pkg.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/40 hover:bg-secondary/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-sm font-semibold">{pkg.label}</span>
                        {pkg.bonus > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium whitespace-nowrap">
                            +{pkg.bonus}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-2xl font-bold">
                        ${pkg.usdcAmount}
                        <span className="text-xs font-normal text-muted-foreground ml-1">USDC</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {pkg.credits.toLocaleString()} credits
                      </div>
                    </button>
                  ))}
                </div>
                <Button
                  className="w-full"
                  disabled={!selected}
                  onClick={() => setStep("send")}
                >
                  {selected
                    ? `Continue — pay $${selected.usdcAmount} USDC`
                    : "Select a package to continue"}
                </Button>
              </>
            )}
          </div>
        )}

        {/* Step 2: Send instructions + tx input */}
        {step === "send" && selected && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send exactly{" "}
              <span className="font-semibold text-foreground">
                ${selected.usdcAmount} USDC
              </span>{" "}
              on Solana mainnet to the treasury address below, then paste the transaction signature.
            </p>

            {/* Treasury address */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Treasury wallet (recipient)
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-2">
                <span className="flex-1 text-xs font-mono break-all text-foreground">
                  {TREASURY_WALLET}
                </span>
                <CopyButton text={TREASURY_WALLET} />
              </div>
            </div>

            {/* Token info */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 space-y-0.5">
                <p className="text-muted-foreground uppercase tracking-wide font-medium">Amount</p>
                <p className="font-semibold text-foreground">${selected.usdcAmount} USDC</p>
              </div>
              <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 space-y-0.5">
                <p className="text-muted-foreground uppercase tracking-wide font-medium">Network</p>
                <p className="font-semibold text-foreground">Solana Mainnet</p>
              </div>
            </div>

            {/* USDC mint for reference */}
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-600 space-y-1">
              <p className="font-semibold">Make sure to send USDC (not SOL or other tokens)</p>
              <p className="font-mono text-[10px] break-all opacity-80">{USDC_MINT}</p>
            </div>

            {/* TX signature input */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Transaction signature (after sending)
              </p>
              <Input
                placeholder="Paste tx signature or Solscan link..."
                value={txInput}
                onChange={(e) => setTxInput(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("packages")}>
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={!txInput.trim()}
                onClick={handleVerify}
              >
                Verify & Get Credits
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Verifying */}
        {step === "verifying" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Verifying transaction on-chain...</p>
            <p className="text-xs text-muted-foreground">Checking Solana for your payment</p>
          </div>
        )}

        {/* Step 4: Success */}
        {step === "success" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <div>
              <p className="text-base font-semibold">Credits added!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {creditsAdded.toLocaleString()} credits have been added to your account.
              </p>
            </div>
            {txInput && (
              <div className="w-full rounded-lg bg-muted/50 border border-border p-3 text-left space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Transaction proof
                </p>
                <p className="text-xs font-mono break-all text-foreground select-all">{txInput}</p>
                <a
                  href={`https://solscan.io/tx/${txInput}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  View on Solscan <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}

        {/* Step 5: Error */}
        {step === "error" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <XCircle className="h-12 w-12 text-red-500" />
            <div>
              <p className="text-sm font-semibold">Verification failed</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">{error}</p>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setStep("send");
                  setError("");
                }}
              >
                Try again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
