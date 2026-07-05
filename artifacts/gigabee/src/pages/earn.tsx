import { useState, useMemo } from "react";
import { useBrowserWorkerContext } from "@/contexts/BrowserWorkerContext";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import {
  useGetEarningsBalance,
  useGetEarningsSummary,
  useGetEarningsHistory,
  useGetPayoutHistory,
  useGetReferralCode,
  useGetReferralStats,
  useRequestWithdrawal,
  getGetMyWorkerQueryOptions,
  getGetEarningsBalanceQueryOptions,
  getGetEarningsSummaryQueryOptions,
  getGetEarningsHistoryQueryOptions,
  getGetPayoutHistoryQueryOptions,
  WorkerStatus,
  getGetEarningsBalanceQueryKey,
  getGetEarningsSummaryQueryKey,
  getGetEarningsHistoryQueryKey,
  getGetPayoutHistoryQueryKey,
  useListApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  getListApiKeysQueryKey,
  type ApiKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { BeeLogo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Cpu,
  Terminal,
  Coins,
  Users,
  ArrowUpRight,
  ArrowRight,
  Copy,
  Check,
  Zap,
  TrendingUp,
  Clock,
  Activity,
  Home,
  BookOpen,
  MessageSquare,
  LogIn,
  Wifi,
  WifiOff,
  Server,
  Star,
  AlertTriangle,
  Eye,
  EyeOff,
  KeyRound,
  Trash2,
  Plus,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { getSessionToken } from "@/lib/socket";

function StatCard({ label, value, sub, mono = false }: { label: string; value: string; sub?: string; mono?: boolean }) {
  return (
    <div className="p-5 rounded-xl border border-border bg-card">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-medium ${mono ? "font-mono text-primary" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function Earn() {
  const bw = useBrowserWorkerContext();
  const [copiedCode, setCopiedCode] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedKeyCopied, setRevealedKeyCopied] = useState(false);

  const sessionToken = useMemo(() => getSessionToken(), []);

  function copyToken() {
    if (!sessionToken) return;
    navigator.clipboard.writeText(sessionToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  }

  const maskedToken = sessionToken
    ? sessionToken.slice(0, 8) + "••••••••••••••••••••••••••••••••" + sessionToken.slice(-4)
    : null;
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawWallet, setWithdrawWallet] = useState("");
  const queryClient = useQueryClient();

  const { data: balance } = useQuery({
    ...getGetEarningsBalanceQueryOptions(),
    refetchInterval: 5_000,
  });
  const { data: summary } = useQuery({
    ...getGetEarningsSummaryQueryOptions(),
    refetchInterval: 5_000,
  });
  const { data: history } = useQuery({
    ...getGetEarningsHistoryQueryOptions(),
    refetchInterval: 10_000,
  });
  const { data: payouts } = useQuery({
    ...getGetPayoutHistoryQueryOptions(),
    refetchInterval: 15_000,
  });
  const { data: referralCode } = useGetReferralCode();
  const { data: referralStats } = useGetReferralStats();
  const { data: worker, isLoading: workerLoading } = useQuery({
    ...getGetMyWorkerQueryOptions(),
    refetchInterval: 5_000,
  });
  const withdrawMutation = useRequestWithdrawal();
  const { data: apiKeysData, refetch: refetchApiKeys } = useListApiKeys();
  const createApiKeyMutation = useCreateApiKey();
  const revokeApiKeyMutation = useRevokeApiKey();

  function copyReferralLink() {
    if (referralCode?.link) {
      navigator.clipboard.writeText(referralCode.link);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }

  async function handleWithdraw() {
    const amount = parseFloat(withdrawAmount);
    if (!amount || !withdrawWallet) return;
    try {
      await withdrawMutation.mutateAsync({ data: { amountUsd: amount, walletAddress: withdrawWallet } });
      queryClient.invalidateQueries({ queryKey: getGetEarningsBalanceQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetPayoutHistoryQueryKey() });
      setWithdrawOpen(false);
      setWithdrawAmount("");
      setWithdrawWallet("");
    } catch {
      // error handled via mutation state
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="earn-page">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center gap-2 px-4 h-12 border-b border-border bg-card sticky top-0 z-10 flex-shrink-0">
        <BeeLogo className="h-5 w-5" />
        <span className="font-medium text-sm flex-1">Earn Honey</span>
        <Link href="/">
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Home">
            <Home className="h-4 w-4" />
          </button>
        </Link>
        <Link href="/chat">
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Chat">
            <MessageSquare className="h-4 w-4" />
          </button>
        </Link>
      </div>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 min-h-0">
      {/* Side nav */}
      <aside className="w-56 border-r border-border bg-card flex-shrink-0 hidden md:flex flex-col p-4">
        <div className="flex items-center gap-2 mb-8">
          <BeeLogo className="h-5 w-5" />
          <span className="font-medium text-sm">Gigabee</span>
        </div>
        <nav className="space-y-1 flex-1">
          {[
            { href: "/", label: "Home", icon: <Home className="h-4 w-4" /> },
            { href: "/chat", label: "Chat", icon: <MessageSquare className="h-4 w-4" /> },
            { href: "/earn", label: "Earn Honey", icon: <Coins className="h-4 w-4" />, active: true },
            { href: "/docs", label: "Docs", icon: <BookOpen className="h-4 w-4" /> },
            { href: "/login", label: "Log in", icon: <LogIn className="h-4 w-4" /> },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={item.active ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-start gap-2 h-9 text-sm"
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {item.icon}
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">Honey balance</p>
          {balance ? (
            <p className="font-mono text-lg font-medium text-primary" data-testid="honey-balance">
              ${balance.honeyUsd.toFixed(4)}
            </p>
          ) : (
            <Skeleton className="h-6 w-20" />
          )}
        </div>
      </aside>

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3 mb-6 sm:mb-8">
            <div>
              <h1 className="text-xl sm:text-2xl font-medium text-foreground mb-1">Earn Honey</h1>
              <p className="text-sm text-muted-foreground">Share compute, earn real USD paid in USDC.</p>
            </div>
            <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="btn-open-withdraw">
                  <ArrowUpRight className="h-4 w-4" />
                  Withdraw
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Withdraw Honey</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="p-3 rounded-xl bg-secondary text-sm text-muted-foreground">
                    Available: <span className="font-mono text-primary font-medium">
                      ${balance?.honeyUsd.toFixed(4) ?? "0.0000"}
                    </span>
                    {" "}· First withdrawal has a 24h review hold.
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount (USD)</Label>
                    <Input
                      type="number"
                      value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      data-testid="input-withdraw-amount"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Solana wallet address (USDC)</Label>
                    <Input
                      value={withdrawWallet}
                      onChange={e => setWithdrawWallet(e.target.value)}
                      placeholder="Solana wallet address"
                      data-testid="input-withdraw-wallet"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleWithdraw}
                    disabled={withdrawMutation.isPending || !withdrawAmount || !withdrawWallet}
                    data-testid="btn-confirm-withdraw"
                  >
                    {withdrawMutation.isPending ? "Processing..." : "Request withdrawal"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {summary ? (
              <>
                <StatCard label="Available Honey" value={`$${summary.balanceUsd.toFixed(4)}`} mono />
                <StatCard label="This month" value={`$${summary.thisMonthUsd.toFixed(4)}`} mono />
                <StatCard label="All-time" value={`$${summary.allTimeUsd.toFixed(2)}`} mono />
                <StatCard label="Jobs served" value={summary.jobsAllTime.toLocaleString()} sub={`${summary.jobsThisMonth} this month`} />
              </>
            ) : (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-5 rounded-xl border border-border bg-card">
                  <Skeleton className="h-3 w-20 mb-2" />
                  <Skeleton className="h-7 w-24" />
                </div>
              ))
            )}
          </div>

          {/* How Earning Works panel */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden mb-6">
            <div className="px-5 py-3.5 border-b border-border bg-secondary/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">How earning works</span>
              </div>
              <Link href="/docs#referrals">
                <button className="text-xs text-primary hover:underline flex items-center gap-1">
                  Full docs <ArrowUpRight className="h-3 w-3" />
                </button>
              </Link>
            </div>

            <div className="p-5 space-y-5">
              {/* Two paths side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* GPU Worker path */}
                <div className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Cpu className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">GPU worker</p>
                  </div>
                  <div className="space-y-2">
                    {[
                      "Connect your GPU via Ollama",
                      "Serve inference jobs for users",
                      "Earn 75% of each job's credit value",
                      "Honey matures after 24h integrity check",
                      "Withdraw as USDC to Solana wallet",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="w-4 h-4 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-[10px] font-medium shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-border space-y-1.5">
                    <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide mb-1">Formula: credits × $0.01 × 75%</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground font-mono">10 × $0.01 × 0.75</span>
                      <span className="font-mono text-primary font-medium">= $0.0750 / job</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground font-mono">15 × $0.01 × 0.75</span>
                      <span className="font-mono text-primary font-medium">= $0.1125 / job</span>
                    </div>
                    <div className="flex justify-between text-xs opacity-60">
                      <span className="text-muted-foreground">Staked (Phase 2, 85%)</span>
                      <span className="font-mono text-foreground">$0.0850 / $0.1275</span>
                    </div>
                  </div>
                </div>

                {/* Referral path */}
                <div className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Referral (no GPU needed)</p>
                  </div>
                  <div className="space-y-2">
                    {[
                      "Copy your referral link below",
                      "Friend signs up and tops up credits",
                      "You earn 5% of their spending",
                      "Commission runs for 12 months",
                      "Capped at $100 per referred user",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="w-4 h-4 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-[10px] font-medium shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-border space-y-1.5">
                    <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide mb-1">Formula: USDC paid × 5%</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground font-mono">$5 Starter pack</span>
                      <span className="font-mono text-primary font-medium">= $0.25 Honey</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground font-mono">$10 Standard pack</span>
                      <span className="font-mono text-primary font-medium">= $0.50 Honey</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground font-mono">$25 Pro pack</span>
                      <span className="font-mono text-primary font-medium">= $1.25 Honey</span>
                    </div>
                    <div className="flex justify-between text-xs opacity-70">
                      <span className="text-muted-foreground">Cap per referee</span>
                      <span className="font-mono text-foreground">$100 lifetime</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Does chatting earn? note */}
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-secondary/50 border border-border">
                <Coins className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground">Chatting doesn't earn Honey.</span>{" "}
                  When you use Bee, you spend credits. You earn by contributing compute (GPU worker) or
                  by bringing new users to the network (referrals). Both earning paths can be active at the same time.
                </p>
              </div>
            </div>
          </div>

          {/* Main tabs */}
          <Tabs defaultValue="browser" className="space-y-6">
            <TabsList className="h-10 w-full grid grid-cols-5">
              <TabsTrigger value="browser" className="gap-1.5 text-xs sm:text-sm px-2" data-testid="tab-browser-worker">
                <Cpu className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Browser</span>
              </TabsTrigger>
              <TabsTrigger value="native" className="gap-1.5 text-xs sm:text-sm px-2" data-testid="tab-native-worker">
                <Terminal className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Native</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm px-2" data-testid="tab-earnings-history">
                <Activity className="h-3.5 w-3.5 shrink-0" />
                History
              </TabsTrigger>
              <TabsTrigger value="referrals" className="gap-1.5 text-xs sm:text-sm px-2" data-testid="tab-referrals">
                <Users className="h-3.5 w-3.5 shrink-0" />
                Referrals
              </TabsTrigger>
              <TabsTrigger value="api-keys" className="gap-1.5 text-xs sm:text-sm px-2" data-testid="tab-api-keys">
                <KeyRound className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">API Keys</span>
                <span className="sm:hidden">Keys</span>
              </TabsTrigger>
            </TabsList>

            {/* Browser Worker */}
            <TabsContent value="browser" className="space-y-4">
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {/* Panel header */}
                <div className="px-5 py-3.5 border-b border-border bg-secondary/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Browser worker</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* WebGPU compatibility badge — always visible */}
                    {bw.gpuSupported === null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                        WebGPU checking
                      </span>
                    )}
                    {bw.gpuSupported === true && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        WebGPU ready
                      </span>
                    )}
                    {bw.gpuSupported === false && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 border border-destructive/20 px-2.5 py-0.5 text-xs font-medium text-destructive">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                        WebGPU unsupported
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                      Bee Nano
                    </span>
                  </div>
                </div>

                {/* Idle state */}
                {bw.status === "idle" && (
                  <>
                    <div className="flex flex-col items-center text-center px-6 py-12 sm:py-16">
                      <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                        <Cpu className="h-7 w-7 text-primary" />
                      </div>
                      <h2 className="text-base font-medium mb-2 text-foreground">Earn with your browser</h2>
                      <p className="text-sm text-muted-foreground mb-7 max-w-xs leading-relaxed">
                        Run Bee Nano directly in your browser via WebGPU. One-time ~400MB download, then earn 75% of each job's value in Honey.
                      </p>
                      <Button
                        size="default"
                        className="gap-2 h-10 px-6"
                        onClick={bw.start}
                        data-testid="btn-start-worker"
                      >
                        <Zap className="h-4 w-4" />
                        Launch browser worker
                      </Button>
                    </div>
                    <div className="px-5 py-3 border-t border-border bg-secondary/10 flex items-center gap-2 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Requires Chrome 113+ with WebGPU enabled · ~400MB one-time download, cached forever</span>
                    </div>
                  </>
                )}

                {/* Checking GPU */}
                {bw.status === "checking" && (
                  <div className="flex flex-col items-center text-center px-6 py-12">
                    <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                    <p className="text-sm font-medium text-foreground">Checking GPU compatibility…</p>
                    <p className="text-xs text-muted-foreground mt-1">Verifying WebGPU support</p>
                  </div>
                )}

                {/* Reconnecting */}
                {bw.status === "reconnecting" && (
                  <div className="flex flex-col items-center text-center px-6 py-10">
                    <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                      <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Reconnecting to hive…</p>
                    <p className="text-xs text-muted-foreground mt-1">Model stays loaded. Resuming automatically.</p>
                  </div>
                )}

                {/* Downloading */}
                {bw.status === "downloading" && (
                  <div className="px-6 py-10 space-y-5">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">Downloading Bee Nano model</p>
                        <p className="text-xs text-muted-foreground">~400MB · cached in browser after first run</p>
                      </div>
                      <span className="text-sm font-mono text-primary font-medium shrink-0">{bw.progress}%</span>
                    </div>
                    <Progress value={bw.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">
                      This only happens once. Future starts load from cache in seconds.
                    </p>
                  </div>
                )}

                {/* Loading into GPU */}
                {bw.status === "loading" && (
                  <div className="flex flex-col items-center text-center px-6 py-12">
                    <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                    <p className="text-sm font-medium text-foreground">Loading model to GPU…</p>
                    <p className="text-xs text-muted-foreground mt-1">Almost ready</p>
                  </div>
                )}

                {/* Benchmarking GPU throughput */}
                {bw.status === "benchmarking" && (
                  <div className="flex flex-col items-center text-center px-6 py-12">
                    <div className="relative mb-4">
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Measuring GPU speed…</p>
                    <p className="text-xs text-muted-foreground mt-1">Running a short inference benchmark — takes ~10 s</p>
                  </div>
                )}

                {/* Ready / Processing */}
                {(bw.status === "ready" || bw.status === "processing") && (
                  <>
                    <div className={`px-5 py-4 border-b border-border flex items-center justify-between gap-3 ${bw.status === "processing" ? "bg-green-500/5" : "bg-primary/5"}`}>
                      {bw.status === "processing" ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-3 w-3 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                            </span>
                            <span className="text-sm font-medium text-green-600 dark:text-green-400" data-testid="worker-status">
                              Processing job…
                            </span>
                          </div>
                          <span className="font-mono text-xs text-green-600 dark:text-green-400 shrink-0">
                            {bw.currentJobTokens} tokens
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-3 w-3 shrink-0">
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                            </span>
                            <span className="text-sm font-medium text-primary" data-testid="worker-status">
                              Online, waiting for jobs
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
                      {[
                        { label: "Speed",        value: bw.currentTps > 0 ? `${bw.currentTps} tok/s` : "—", mono: true  },
                        { label: "Jobs served",  value: bw.jobsServed.toLocaleString(),                      mono: true  },
                        { label: "Total tokens", value: bw.tokensGenerated.toLocaleString(),                  mono: true  },
                        { label: "Honey earned", value: `$${bw.honeyEarned.toFixed(4)}`,                    mono: true  },
                      ].map(s => (
                        <div key={s.label} className="bg-card px-4 py-4">
                          <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                          <p className={`text-sm font-medium ${s.mono ? "font-mono text-primary" : "text-foreground"}`}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-4">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Earning 75% of each job's credit value in Honey.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={bw.stop}
                        data-testid="btn-stop-worker"
                        className="shrink-0"
                      >
                        Stop worker
                      </Button>
                    </div>
                  </>
                )}

                {/* Error state */}
                {bw.status === "error" && (
                  <>
                    <div className="flex flex-col items-center text-center px-6 py-10 space-y-4">
                      <div className="h-12 w-12 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground mb-1">Worker failed to start</p>
                        <p className="text-xs text-muted-foreground max-w-xs">{bw.errorMessage}</p>
                      </div>
                      <Button size="sm" onClick={bw.start} className="gap-2">
                        <Zap className="h-3.5 w-3.5" />
                        Try again
                      </Button>
                    </div>
                    <div className="px-5 py-3 border-t border-border bg-secondary/10 flex items-center gap-2 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Requires Chrome 113+ with WebGPU enabled</span>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            {/* Native Worker */}
            <TabsContent value="native" className="space-y-4">

              {/* ── Worker monitor ─────────────────────────────────────── */}
              {workerLoading ? (
                <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                  <div className="grid grid-cols-4 gap-3">
                    {[0,1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
                  </div>
                </div>
              ) : worker ? (
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  {/* Status header */}
                  <div className={`px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-2 border-b border-border ${
                    worker.status === WorkerStatus.serving
                      ? "bg-green-500/5"
                      : worker.status === WorkerStatus.idle
                      ? "bg-primary/5"
                      : "bg-secondary/30"
                  }`}>
                    <div className="flex items-center gap-3">
                      {worker.status === WorkerStatus.serving ? (
                        <>
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                          </span>
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">Online, serving jobs</span>
                        </>
                      ) : worker.status === WorkerStatus.idle ? (
                        <>
                          <span className="relative flex h-3 w-3">
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                          </span>
                          <span className="text-sm font-medium text-primary">Online, idle</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">Offline</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {worker.lastSeen
                          ? `Last seen ${new Date(worker.lastSeen).toLocaleTimeString("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })} UTC`
                          : "Never connected"}
                      </span>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
                    <div className="bg-card px-4 sm:px-5 py-4">
                      <p className="text-xs text-muted-foreground mb-1">Jobs served</p>
                      <p className="text-xl font-mono font-medium text-foreground">
                        {worker.totalJobsServed.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-card px-4 sm:px-5 py-4">
                      <p className="text-xs text-muted-foreground mb-1">Speed</p>
                      <p className="text-xl font-mono font-medium text-foreground">
                        {worker.capabilities?.tokensPerSecond
                          ? `${worker.capabilities.tokensPerSecond.toFixed(1)} t/s`
                          : "-"}
                      </p>
                    </div>
                    <div className="bg-card px-4 sm:px-5 py-4">
                      <p className="text-xs text-muted-foreground mb-1">Reputation</p>
                      <div className="flex items-center gap-1.5">
                        <Star className="h-4 w-4 text-primary fill-primary" />
                        <p className="text-xl font-mono font-medium text-foreground">
                          {worker.reputationScore.toFixed(2)}
                          <span className="text-xs text-muted-foreground font-sans"> /10</span>
                        </p>
                      </div>
                    </div>
                    <div className="bg-card px-4 sm:px-5 py-4">
                      <p className="text-xs text-muted-foreground mb-1">Model</p>
                      <p className="text-sm font-mono font-medium text-foreground truncate">
                        {worker.capabilities?.model ?? "bee-hover"}
                      </p>
                    </div>
                  </div>

                  {/* Worker ID */}
                  <div className="px-4 sm:px-6 py-3 border-t border-border bg-secondary/20 flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground font-mono truncate">{worker.id}</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                    <Wifi className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">No worker registered yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Follow the setup steps below to connect your GPU and start earning Honey.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Your Worker Token ──────────────────────────────────── */}
              <div className="p-4 sm:p-6 rounded-2xl border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-3 mb-4">
                  <KeyRound className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-medium">Your worker token</h2>
                  <Badge className="text-xs ml-auto bg-primary/10 text-primary border-primary/20">Required to run worker</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  This token authenticates your worker with the Gigabee network. Keep it private, anyone with this token can earn on your behalf and your credits.
                </p>
                {sessionToken ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-background border border-border font-mono text-xs text-foreground overflow-hidden">
                      <span className="flex-1 truncate select-all">
                        {tokenVisible ? sessionToken : maskedToken}
                      </span>
                      <button
                        onClick={() => setTokenVisible(v => !v)}
                        className="shrink-0 p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        title={tokenVisible ? "Hide token" : "Show token"}
                      >
                        {tokenVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={copyToken}
                        className="shrink-0 p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        title="Copy token"
                      >
                        {tokenCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground/60">
                      Token is stored locally in your browser. Log out to revoke it.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-background border border-border text-xs text-muted-foreground">
                    Sign in first to get your worker token.
                  </div>
                )}
              </div>

              {/* ── Setup instructions ─────────────────────────────────── */}
              <div className="p-4 sm:p-6 rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-3 mb-5">
                  <Terminal className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-medium">Setup guide</h2>
                  <Badge variant="secondary" className="text-xs ml-auto">Earn 75% per job</Badge>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Step 1, Install Ollama and pull a model</p>
                    <pre className="bg-background border border-border rounded-xl p-4 text-sm font-mono text-foreground overflow-x-auto whitespace-pre">{"# ollama.ai, install, then:\nollama pull llama3.3:70b"}</pre>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Step 2, Download gigabee-worker.mjs then run</p>
                    <pre className="bg-background border border-border rounded-xl p-4 text-sm font-mono text-foreground overflow-x-auto whitespace-pre">
                      {sessionToken
                        ? `export GIGABEE_TOKEN=${tokenVisible ? sessionToken : sessionToken.slice(0,8) + "••••••••••••"}\nnode gigabee-worker.mjs`
                        : "export GIGABEE_TOKEN=<your-token-from-above>\nnode gigabee-worker.mjs"
                      }
                    </pre>
                  </div>
                </div>

                <div className="mt-5 p-4 rounded-xl bg-secondary border border-border">
                  <p className="text-xs text-muted-foreground font-medium mb-3">Hardware requirements</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { model: "Bee Hover (~8B)", vram: "≥ 6 GB VRAM" },
                      { model: "Bee Glide (~27B)", vram: "≥ 16 GB VRAM" },
                    ].map(row => (
                      <div key={row.model} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{row.model}</span>
                        <span className="font-mono text-xs">{row.vram}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Earnings History */}
            <TabsContent value="history" className="space-y-4">
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border bg-card">
                  <h3 className="text-sm font-medium">Earnings history</h3>
                </div>
                {history && history.length > 0 ? (
                  <table className="w-full text-sm" data-testid="earnings-table">
                    <thead className="border-b border-border bg-secondary/30">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">Date</th>
                        <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">Model</th>
                        <th className="px-4 py-3 text-right text-xs text-muted-foreground font-medium">Tokens</th>
                        <th className="px-4 py-3 text-right text-xs text-muted-foreground font-medium">Earned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(e => (
                        <tr key={e.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {new Date(e.createdAt).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" })} UTC
                          </td>
                          <td className="px-4 py-3 text-sm">{e.model}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm">{e.tokensServed}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-primary">${e.amountUsd.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-12 text-center">
                    <TrendingUp className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No earnings yet. Start a worker to begin earning Honey.</p>
                  </div>
                )}
              </div>

              {/* Payout history */}
              {payouts && payouts.length > 0 && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="p-4 border-b border-border bg-card">
                    <h3 className="text-sm font-medium">Payout history</h3>
                  </div>
                  <table className="w-full text-sm" data-testid="payouts-table">
                    <thead className="border-b border-border bg-secondary/30">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">Date</th>
                        <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">Status</th>
                        <th className="px-4 py-3 text-right text-xs text-muted-foreground font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map(p => (
                        <tr key={p.id} className="border-b border-border/50">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {new Date(p.createdAt).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" })} UTC
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={p.status === "completed" ? "default" : "secondary"} className="text-xs">
                              {p.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-primary">
                            ${p.amountUsd.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Referrals */}
            <TabsContent value="referrals" className="space-y-4">
              <div className="p-6 rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-3 mb-4">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-medium">Referral program</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Earn 5% of each referred user's spend for 12 months. Payments are automatic and traceable to real revenue, not token emissions.
                </p>

                {/* Referral link */}
                <div className="space-y-2 mb-6">
                  <Label className="text-xs text-muted-foreground">Your referral link</Label>
                  <div className="flex gap-2">
                    <Input
                      value={referralCode?.link ?? "Sign in to get your link"}
                      readOnly
                      className="font-mono text-xs h-9"
                      data-testid="input-referral-link"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyReferralLink}
                      className="h-9 px-3 flex-shrink-0 gap-1.5"
                      data-testid="btn-copy-referral"
                    >
                      {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>

                {/* Stats */}
                {referralStats ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-border bg-background text-center">
                      <p className="text-2xl font-medium text-foreground" data-testid="referral-total">
                        {referralStats.totalReferred}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Referred</p>
                    </div>
                    <div className="p-4 rounded-xl border border-border bg-background text-center">
                      <p className="text-2xl font-mono font-medium text-primary">
                        ${referralStats.earningsUsd.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Earned</p>
                    </div>
                    <div className="p-4 rounded-xl border border-border bg-background text-center">
                      <p className="text-2xl font-medium text-foreground">
                        {referralStats.activeReferrals}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Active</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-4 p-3 rounded-lg bg-secondary border border-border">
                  Anti-abuse: referral earnings are capped per referee. Referrals are invalidated on detected abuse (account sharing, VPN cycling). Single-level only, no multi-level.
                </p>
              </div>
            </TabsContent>

            {/* API Keys */}
            <TabsContent value="api-keys" className="space-y-4" data-testid="tab-content-api-keys">
              {/* Revealed key banner */}
              {revealedKey && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-sm font-medium text-foreground">API key created — save it now</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This key will not be shown again. Copy and store it somewhere safe before leaving this tab.
                  </p>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-background border border-border font-mono text-xs text-foreground overflow-hidden">
                    <span className="flex-1 truncate select-all">{revealedKey}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(revealedKey);
                        setRevealedKeyCopied(true);
                        setTimeout(() => setRevealedKeyCopied(false), 2000);
                      }}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                      title="Copy key"
                    >
                      {revealedKeyCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <button
                    onClick={() => setRevealedKey(null)}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    I've saved it, dismiss
                  </button>
                </div>
              )}

              {/* Create new key */}
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <KeyRound className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-medium">Create API key</h2>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {apiKeysData?.keys?.length ?? 0} / 10
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  API keys authenticate requests to <code className="font-mono bg-secondary px-1 py-0.5 rounded text-[11px]">https://gigabee.io/api/v1</code>.
                  Same pricing as chat. Use them with Hermes, LangChain, Vercel AI SDK, or any OpenAI-compatible tool.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={newKeyLabel}
                    onChange={e => setNewKeyLabel(e.target.value)}
                    placeholder="Label (optional, e.g. hermes-dev)"
                    className="h-9 text-sm flex-1"
                    maxLength={80}
                    data-testid="input-new-key-label"
                  />
                  <Button
                    size="sm"
                    className="h-9 gap-1.5 shrink-0"
                    disabled={createApiKeyMutation.isPending || (apiKeysData?.keys?.length ?? 0) >= 10}
                    onClick={async () => {
                      try {
                        const result = await createApiKeyMutation.mutateAsync({
                          data: newKeyLabel ? { label: newKeyLabel } : undefined,
                        });
                        setRevealedKey(result.key);
                        setNewKeyLabel("");
                        refetchApiKeys();
                      } catch {
                        // error surface via mutation state
                      }
                    }}
                    data-testid="btn-create-api-key"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {createApiKeyMutation.isPending ? "Creating..." : "Create key"}
                  </Button>
                </div>
                {createApiKeyMutation.isError && (
                  <p className="text-xs text-red-500 mt-2">
                    {(createApiKeyMutation.error as Error)?.message ?? "Failed to create key. Try again."}
                  </p>
                )}
              </div>

              {/* Key list */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border bg-card flex items-center justify-between">
                  <h3 className="text-sm font-medium">Active keys</h3>
                  <Link href="/docs#agent-frameworks">
                    <button className="text-xs text-primary hover:underline flex items-center gap-1">
                      Setup docs <ExternalLink className="h-3 w-3" />
                    </button>
                  </Link>
                </div>
                {apiKeysData?.keys && apiKeysData.keys.length > 0 ? (
                  <div className="divide-y divide-border">
                    {apiKeysData.keys.map((key: ApiKey) => (
                      <div key={key.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/10 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono text-foreground">{key.keyPrefix}…</code>
                            {key.label && (
                              <span className="text-xs text-muted-foreground truncate">{key.label}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Created {new Date(key.createdAt).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" })}
                            {key.lastUsedAt && (
                              <> · Last used {new Date(key.lastUsedAt).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" })}</>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            if (!confirm("Revoke this API key? Any apps using it will stop working immediately.")) return;
                            try {
                              await revokeApiKeyMutation.mutateAsync({ id: key.id });
                              refetchApiKeys();
                            } catch {
                              // error surface via mutation state
                            }
                          }}
                          disabled={revokeApiKeyMutation.isPending}
                          className="p-2 rounded-lg hover:bg-red-500/10 hover:text-red-500 text-muted-foreground transition-colors"
                          title="Revoke key"
                          data-testid={`btn-revoke-key-${key.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <KeyRound className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No API keys yet. Create one above to start using the Gigabee API.</p>
                  </div>
                )}
              </div>

              {/* Quick setup card */}
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Terminal className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-medium">Quick setup: Hermes Agent</h2>
                  <Badge variant="secondary" className="text-xs ml-auto">OpenAI-compatible</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  Install <code className="font-mono bg-secondary px-1 py-0.5 rounded text-[11px]">hermes</code> and point it at Gigabee. Your API key goes in the <code className="font-mono bg-secondary px-1 py-0.5 rounded text-[11px]">GIGABEE_API_KEY</code> env var below.
                </p>
                <pre className="bg-background border border-border rounded-xl p-4 text-xs font-mono text-foreground overflow-x-auto whitespace-pre leading-relaxed">{`pip install hermes-agent

export GIGABEE_API_KEY=giga_your_key_here

hermes config set base_url https://gigabee.io/api/v1
hermes config set api_key $GIGABEE_API_KEY
hermes config set model bee-glide

hermes run "Summarise recent AI papers on mixture-of-experts"`}</pre>
                <p className="text-xs text-muted-foreground mt-3">
                  Works with LangChain, Vercel AI SDK, and any other OpenAI-compatible client.{" "}
                  <Link href="/docs#agent-frameworks">
                    <span className="text-primary hover:underline cursor-pointer">Full docs →</span>
                  </Link>
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      </div>
    </div>
  );
}
