import { useState, useEffect, useCallback, useRef } from "react";
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
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { getSessionToken } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCreditsBalanceQueryKey } from "@workspace/api-client-react";

const TREASURY_WALLET = "4ojZUbahagMhCsnPgVqNmHWydfL5u97LYHG3ZjfZDouy";
const GB_MINT        = "7NcMKMrXPBVCWPcs9SSqnF6ZGy5neAtzTZpFqZqLquaP";
const PRICE_REFRESH_MS = 30_000;

interface PackageDef {
  id: string;
  label: string;
  usdAmount: number;
  credits: number;
  bonus: number;
}

type Step = "packages" | "send" | "verifying" | "success" | "error";

interface Props {
  open: boolean;
  onClose: () => void;
}

// ── Price fetch — direct to DexScreener (CORS-open, fast) ────────────────────
async function fetchGbPriceFrontend(): Promise<number | null> {
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${GB_MINT}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!r.ok) throw new Error("dexscreener error");
    const d = await r.json() as {
      pairs?: Array<{ priceUsd?: string; liquidity?: { usd?: number } }>;
    };
    const pairs = d.pairs ?? [];
    if (!pairs.length) return null;
    const sorted = [...pairs].sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
    );
    const price = parseFloat(sorted[0]?.priceUsd ?? "0");
    return isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="shrink-0 p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
    >
      {copied
        ? <Check className="h-3.5 w-3.5 text-green-500" />
        : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function BuyCreditsModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();

  // Packages (static from API)
  const [packages, setPackages]     = useState<PackageDef[]>([]);
  const [pkgsLoading, setPkgsLoading] = useState(true);

  // Live price (fetched on frontend)
  const [gbPrice, setGbPrice]         = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceTs, setPriceTs]           = useState<number | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Wizard state
  const [selected, setSelected] = useState<PackageDef | null>(null);
  const [step, setStep]         = useState<Step>("packages");
  const [txInput, setTxInput]   = useState("");
  const [creditsAdded, setCreditsAdded] = useState(0);
  const [error, setError]       = useState("");

  // Derived: how many $GB for the selected package (ceil = always enough)
  const selectedGb = selected && gbPrice
    ? Math.ceil(selected.usdAmount / gbPrice)
    : null;

  // ── Fetch static packages ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setPkgsLoading(true);
    fetch("/api/credits/packages")
      .then(r => r.json())
      .then((d: { packages: PackageDef[] }) => setPackages(d.packages))
      .catch(() => {/* ignore */})
      .finally(() => setPkgsLoading(false));
  }, [open]);

  // ── Fetch live $GB price (frontend → DexScreener) ────────────────────────
  const refreshPrice = useCallback(async () => {
    setPriceLoading(true);
    const p = await fetchGbPriceFrontend();
    setGbPrice(p);
    setPriceTs(Date.now());
    setPriceLoading(false);
  }, []);

  useEffect(() => {
    if (!open) {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
      return;
    }
    void refreshPrice();
    refreshTimer.current = setInterval(() => void refreshPrice(), PRICE_REFRESH_MS);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [open, refreshPrice]);

  // ── Helpers ──────────────────────────────────────────────────────────────
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
    const t = raw.trim();
    const m = t.match(/\/tx\/([A-Za-z0-9]{60,})/);
    return m ? m[1] : t;
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
        body: JSON.stringify({ txSignature: sig, packageId: selected.id }),
      });
      const body = await res.json() as { ok?: boolean; credits?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Verification failed");
      setCreditsAdded(body.credits ?? selected.credits);
      setStep("success");
      await queryClient.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("error");
    }
  }

  // ── Price display helpers ────────────────────────────────────────────────
  function fmtGb(n: number) {
    return n.toLocaleString();
  }

  function PriceBadge() {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        {priceLoading
          ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          : <TrendingUp className="h-3 w-3 text-muted-foreground" />}
        <span className={gbPrice ? "text-foreground font-mono font-medium" : "text-muted-foreground"}>
          {gbPrice ? `$${gbPrice.toFixed(6)}/GB` : "Fetching price…"}
        </span>
        <button
          onClick={() => void refreshPrice()}
          disabled={priceLoading}
          className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh price"
        >
          <RefreshCw className={`h-3 w-3 ${priceLoading ? "animate-spin" : ""}`} />
        </button>
        {priceTs && !priceLoading && (
          <span className="text-muted-foreground/60">
            {Math.round((Date.now() - priceTs) / 1000)}s ago
          </span>
        )}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Buy Credits</DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Pick package ─────────────────────────────────────── */}
        {step === "packages" && (
          <div className="space-y-4">
            {pkgsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    1 credit = $0.01 · pay with{" "}
                    <span className="font-semibold text-foreground">$GB</span>
                  </p>
                  <PriceBadge />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {packages.map((pkg) => {
                    const gb = gbPrice ? Math.ceil(pkg.usdAmount / gbPrice) : null;
                    return (
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
                        {/* USD — fixed */}
                        <div className="mt-2 text-2xl font-bold">${pkg.usdAmount}</div>
                        {/* $GB — live */}
                        <div className="text-xs text-primary/80 mt-0.5 font-mono">
                          {priceLoading && !gbPrice
                            ? <Loader2 className="h-3 w-3 animate-spin inline" />
                            : gb !== null
                              ? `≈ ${fmtGb(gb)} $GB`
                              : <span className="text-muted-foreground">…</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {pkg.credits.toLocaleString()} credits
                        </div>
                      </button>
                    );
                  })}
                </div>

                <Button
                  className="w-full"
                  disabled={!selected}
                  onClick={() => setStep("send")}
                >
                  {selected
                    ? selectedGb !== null
                      ? `Continue — ≈ ${fmtGb(selectedGb)} $GB ($${selected.usdAmount})`
                      : `Continue — $${selected.usdAmount}`
                    : "Select a package"}
                </Button>
              </>
            )}
          </div>
        )}

        {/* ── Step 2: Send ─────────────────────────────────────────────── */}
        {step === "send" && selected && (
          <div className="space-y-4">
            {/* Hero amount */}
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Send exactly
              </p>
              {gbPrice ? (
                <>
                  <p className="text-3xl font-bold text-foreground">
                    {selectedGb !== null ? fmtGb(selectedGb) : "…"}{" "}
                    <span className="text-primary">$GB</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ≈ ${selected.usdAmount} USD at ${gbPrice.toFixed(6)}/GB
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Fetching live price…</span>
                </div>
              )}
              <div className="flex items-center justify-center gap-2 mt-2">
                <PriceBadge />
              </div>
            </div>

            {/* Treasury address */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Treasury wallet (recipient)
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-2">
                <span className="flex-1 text-xs font-mono break-all">{TREASURY_WALLET}</span>
                <CopyButton text={TREASURY_WALLET} />
              </div>
            </div>

            {/* Token info */}
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-600 space-y-1">
              <p className="font-semibold">Send $GB only — not SOL or other tokens</p>
              <div className="flex items-center gap-1">
                <span className="font-mono text-[10px] break-all opacity-80 flex-1">{GB_MINT}</span>
                <CopyButton text={GB_MINT} />
              </div>
            </div>

            {/* TX input */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Transaction signature (after sending)
              </p>
              <Input
                placeholder="Paste tx hash or Solscan link…"
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

        {/* ── Step 3: Verifying ────────────────────────────────────────── */}
        {step === "verifying" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Verifying on-chain…</p>
            <p className="text-xs text-muted-foreground">Checking Solana for your $GB payment</p>
          </div>
        )}

        {/* ── Step 4: Success ──────────────────────────────────────────── */}
        {step === "success" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <div>
              <p className="text-base font-semibold">Credits added!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {creditsAdded.toLocaleString()} credits added to your account.
              </p>
            </div>
            {txInput && (
              <div className="w-full rounded-lg bg-muted/50 border border-border p-3 text-left space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Transaction
                </p>
                <p className="text-xs font-mono break-all select-all">{txInput}</p>
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
            <Button className="w-full" onClick={handleClose}>Done</Button>
          </div>
        )}

        {/* ── Step 5: Error ────────────────────────────────────────────── */}
        {step === "error" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <XCircle className="h-12 w-12 text-red-500" />
            <div>
              <p className="text-sm font-semibold">Verification failed</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">{error}</p>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
              <Button className="flex-1" onClick={() => { setStep("send"); setError(""); }}>
                Try again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
