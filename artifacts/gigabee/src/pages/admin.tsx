import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const API_BASE = "/api/admin";
const TOKEN_KEY = "gigabee_admin_token";
const POLL_MS   = 8_000;

// ─── Types ───────────────────────────────────────────────────────────────────

type PayoutStatus = "requested" | "held" | "review" | "screening" | "batched" | "sent" | "failed";
type Tab = "stats" | "payouts";

interface Overview {
  pendingCount: number;
  pendingUsd: number;
  paidCount: number;
  paidUsd: number;
  workerEarningsUsd: number;
  platformRevenueUsd: number;
  treasuryReady: boolean;
  treasuryError: string | null;
}

interface UsageStats {
  tokensAllTime:   number;
  creditsReceived: number;
  creditsSpent:    number;
  creditsFree:     number;
  totalUsers:      number;
  totalJobs:       number;
  workersOnline:   number;
  jobsByModel:     { model: string; jobs: number; credits: number; tokens: number }[];
  daily:           { day: string; jobs: number; credits: number; tokens: number }[];
  byStatus:        { status: string; count: number }[];
}

interface Payout {
  id: string;
  email: string;
  walletAddress: string;
  amountUsd: number;
  status: PayoutStatus;
  txHash: string | null;
  requestedAt: string;
  sentAt: string | null;
  holdUntil: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt     = (usd: number) => `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC";
const truncate = (s: string, n = 10) => s.length > n * 2 ? `${s.slice(0, n)}...${s.slice(-6)}` : s;

const MODEL_LABEL: Record<string, string> = {
  "bee-nano":  "Bee Nano",
  "bee-hover": "Bee Hover",
  "bee-glide": "Bee Glide",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PayoutStatus }) {
  const map: Record<PayoutStatus, string> = {
    requested: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    held:      "bg-orange-500/15 text-orange-400 border-orange-500/30",
    review:    "bg-red-500/15 text-red-400 border-red-500/30",
    screening: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    batched:   "bg-purple-500/15 text-purple-400 border-purple-500/30",
    sent:      "bg-green-500/15 text-green-400 border-green-500/30",
    failed:    "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status]}`}>
      {status}
    </span>
  );
}

function StatCard({ label, value, sub, pulse }: { label: string; value: string; sub?: string; pulse?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2">
        {pulse && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
        )}
        <p className="text-xl font-semibold font-mono text-foreground">{value}</p>
      </div>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (value === prev.current) return;
    const diff = value - prev.current;
    const steps = 30;
    const step  = diff / steps;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplay(Math.round(prev.current + step * i));
      if (i >= steps) { clearInterval(id); prev.current = value; setDisplay(value); }
    }, 20);
    return () => clearInterval(id);
  }, [value]);

  return <span>{display.toLocaleString()}</span>;
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────

function StatsTab({ token }: { token: string }) {
  const [data, setData]   = useState<UsageStats | null>(null);
  const [lastAt, setLastAt] = useState<Date | null>(null);

  const fetchUsage = useCallback(async () => {
    const r = await fetch(`${API_BASE}/usage`, { headers: { Authorization: `Admin ${token}` } });
    if (!r.ok) return;
    setData(await r.json());
    setLastAt(new Date());
  }, [token]);

  useEffect(() => {
    fetchUsage();
    const id = setInterval(fetchUsage, POLL_MS);
    return () => clearInterval(id);
  }, [fetchUsage]);

  if (!data) {
    return (
      <div className="flex items-center justify-center py-24 text-xs text-muted-foreground">
        Loading network stats…
      </div>
    );
  }

  const creditsBalance = data.creditsReceived + data.creditsFree - data.creditsSpent;
  const chartMetric: "jobs" | "credits" | "tokens" = "jobs";

  return (
    <div className="space-y-8">
      {/* Hero counter */}
      <div className="rounded-2xl border border-border bg-card/60 px-8 py-8">
        <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase mb-2">tokens generated by the network</p>
        <p className="text-5xl sm:text-6xl font-bold font-mono text-foreground tabular-nums leading-none">
          <AnimatedNumber value={data.tokensAllTime} />
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-xs text-muted-foreground">
          <span><span className="text-foreground font-medium">{data.totalJobs.toLocaleString()}</span> total jobs</span>
          <span><span className="text-foreground font-medium">{data.totalUsers.toLocaleString()}</span> users</span>
          <span><span className="text-primary font-medium">{data.workersOnline}</span> workers online</span>
          {lastAt && <span className="ml-auto">updated {lastAt.toLocaleTimeString()}</span>}
        </div>
      </div>

      {/* Credit summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Credits received"  value={data.creditsReceived.toLocaleString()} sub={`$${(data.creditsReceived * 0.01).toFixed(2)} USD`} />
        <StatCard label="Credits spent"     value={data.creditsSpent.toLocaleString()}    sub={`$${(data.creditsSpent * 0.01).toFixed(2)} USD`} />
        <StatCard label="Credits balance"   value={creditsBalance.toLocaleString()}       sub="received + free − spent" />
        <StatCard label="Workers online"    value={String(data.workersOnline)}            sub="live count" pulse={data.workersOnline > 0} />
      </div>

      {/* Daily chart */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Jobs per day (last 14 days)</p>
          <p className="text-xs text-muted-foreground">auto-refreshes every {POLL_MS / 1000}s</p>
        </div>
        <div className="px-4 py-4">
          {data.daily.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.daily} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={d => d.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))", marginBottom: 4 }}
                  itemStyle={{ color: "hsl(var(--primary))" }}
                />
                <Bar dataKey={chartMetric} fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Credits chart */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="text-sm font-medium text-foreground">Credits spent per day (last 14 days)</p>
        </div>
        <div className="px-4 py-4">
          {data.daily.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.daily} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={d => d.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))", marginBottom: 4 }}
                  itemStyle={{ color: "hsl(var(--primary))" }}
                />
                <Bar dataKey="credits" name="credits spent" fill="hsl(var(--primary) / 0.7)" radius={[3, 3, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Per-model table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="text-sm font-medium text-foreground">All-time usage by model</p>
        </div>
        <div className="divide-y divide-border">
          {/* Header */}
          <div className="grid grid-cols-4 gap-4 px-5 py-2 bg-muted/20 text-xs font-medium text-muted-foreground">
            <span>Model</span>
            <span className="text-right">Jobs</span>
            <span className="text-right">Tokens</span>
            <span className="text-right">Credits</span>
          </div>
          {data.jobsByModel.length === 0 && (
            <div className="px-5 py-8 text-center text-xs text-muted-foreground">No jobs yet</div>
          )}
          {data.jobsByModel.map(row => (
            <div key={row.model} className="grid grid-cols-4 gap-4 px-5 py-3 text-sm items-center">
              <span className="font-medium text-foreground">
                {MODEL_LABEL[row.model] ?? row.model}
                <span className="text-xs text-muted-foreground font-normal ml-1.5">{row.model}</span>
              </span>
              <span className="font-mono text-right text-foreground">{row.jobs.toLocaleString()}</span>
              <span className="font-mono text-right text-muted-foreground">{row.tokens.toLocaleString()}</span>
              <span className="font-mono text-right text-primary">{row.credits.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Job status breakdown */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="text-sm font-medium text-foreground">Jobs by status (all-time)</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border">
          {data.byStatus.map(s => (
            <div key={s.status} className="bg-card px-4 py-4">
              <p className="text-xs text-muted-foreground capitalize mb-1">{s.status}</p>
              <p className="text-lg font-mono font-semibold text-foreground">{s.count.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Payouts Tab ──────────────────────────────────────────────────────────────

type Filter = "pending" | "all" | "sent" | "failed";
const FILTERS: { label: string; value: Filter }[] = [
  { label: "Pending", value: "pending" },
  { label: "All",     value: "all" },
  { label: "Sent",    value: "sent" },
  { label: "Failed",  value: "failed" },
];

function PayoutsTab({ token, overview }: { token: string; overview: Overview | null }) {
  const authHeaders = useCallback(
    () => ({ "Content-Type": "application/json", Authorization: `Admin ${token}` }),
    [token],
  );

  const [payouts,    setPayouts]    = useState<Payout[]>([]);
  const [filter,     setFilter]     = useState<Filter>("pending");
  const [loading,    setLoading]    = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [rejecting,  setRejecting]  = useState<string | null>(null);
  const [sending,    setSending]    = useState<string | null>(null);
  const [rowError,   setRowError]   = useState<Record<string, string>>({});

  const fetchPayouts = useCallback(async (f: Filter) => {
    setLoading(true);
    const r = await fetch(`${API_BASE}/payouts?filter=${f}`, { headers: authHeaders() });
    setLoading(false);
    if (!r.ok) return;
    setPayouts(await r.json());
  }, [authHeaders]);

  useEffect(() => { fetchPayouts(filter); }, [filter, fetchPayouts]);

  const doApprove = async (id: string) => {
    setSending(id);
    setRowError(e => ({ ...e, [id]: "" }));
    const r = await fetch(`${API_BASE}/payouts/${id}/approve`, { method: "POST", headers: authHeaders() });
    setSending(null); setConfirming(null);
    const json = await r.json();
    if (!r.ok) { setRowError(e => ({ ...e, [id]: json.error ?? "Transfer failed" })); return; }
    fetchPayouts(filter);
  };

  const doReject = async (id: string) => {
    setRowError(e => ({ ...e, [id]: "" }));
    const r = await fetch(`${API_BASE}/payouts/${id}/reject`, { method: "POST", headers: authHeaders() });
    setRejecting(null);
    const json = await r.json();
    if (!r.ok) { setRowError(e => ({ ...e, [id]: json.error ?? "Failed" })); return; }
    fetchPayouts(filter);
  };

  return (
    <div className="space-y-4">
      {/* Overview cards */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Pending payouts",  value: fmt(overview.pendingUsd),         sub: `${overview.pendingCount} requests` },
            { label: "Total paid out",   value: fmt(overview.paidUsd),            sub: `${overview.paidCount} completed` },
            { label: "Worker earnings",  value: fmt(overview.workerEarningsUsd),  sub: "all-time, 75% rate" },
            { label: "Platform revenue", value: fmt(overview.platformRevenueUsd), sub: "25% cut, estimated" },
          ].map(stat => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} sub={stat.sub} />
          ))}
        </div>
      )}

      {/* Filter + table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium text-foreground">Payout requests</h2>
          <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  filter === f.value
                    ? "bg-background text-foreground shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-muted/20 border-b border-border text-xs font-medium text-muted-foreground">
            <span>Date</span><span>User / Wallet</span><span>Amount</span><span>Status</span>
            <span className="w-32 text-right">Actions</span>
          </div>

          {loading && <div className="px-5 py-10 text-center text-xs text-muted-foreground">Loading...</div>}

          {!loading && payouts.length === 0 && (
            <div className="px-5 py-10 text-center text-xs text-muted-foreground">No payouts in this view.</div>
          )}

          {!loading && payouts.map((p, i) => {
            const isOnHold = !!p.holdUntil && new Date(p.holdUntil) > new Date();
            const isSending = sending === p.id;
            const canAct = p.status !== "sent" && p.status !== "failed";

            return (
              <div key={p.id}>
                <div className={`grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 px-5 py-4 items-start ${i < payouts.length - 1 ? "border-b border-border/50" : ""} ${confirming === p.id || rejecting === p.id ? "bg-muted/10" : ""}`}>
                  <div>
                    <p className="text-xs text-foreground">{fmtDate(p.requestedAt)}</p>
                    {isOnHold && <p className="text-xs text-orange-400 mt-0.5">Hold until {fmtDate(p.holdUntil!)}</p>}
                    {p.sentAt  && <p className="text-xs text-muted-foreground mt-0.5">Sent {fmtDate(p.sentAt)}</p>}
                  </div>
                  <div>
                    <p className="text-xs text-foreground font-medium">{p.email}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{truncate(p.walletAddress)}</p>
                    {p.txHash && (
                      <a href={`https://solscan.io/tx/${p.txHash}`} target="_blank" rel="noreferrer"
                        className="text-xs font-mono text-primary hover:underline mt-0.5 block">
                        tx: {truncate(p.txHash, 8)}
                      </a>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-mono font-semibold text-foreground">{fmt(p.amountUsd)}</p>
                    <p className="text-xs text-muted-foreground">$GB</p>
                  </div>
                  <div><StatusBadge status={p.status} /></div>
                  <div className="w-32 flex gap-2 justify-end">
                    {canAct && !isOnHold && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-green-400 border-green-500/30 hover:bg-green-500/10" disabled={isSending}
                          onClick={() => { setConfirming(confirming === p.id ? null : p.id); setRejecting(null); setRowError(e => ({ ...e, [p.id]: "" })); }}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" disabled={isSending}
                          onClick={() => { setRejecting(rejecting === p.id ? null : p.id); setConfirming(null); setRowError(e => ({ ...e, [p.id]: "" })); }}>
                          Reject
                        </Button>
                      </>
                    )}
                    {canAct && isOnHold && <span className="text-xs text-orange-400 text-right">On hold</span>}
                    {p.status === "sent"   && <span className="text-xs text-green-400">Completed</span>}
                    {p.status === "failed" && <span className="text-xs text-muted-foreground">Rejected</span>}
                  </div>
                </div>

                {rowError[p.id] && (
                  <div className="px-5 py-2 bg-destructive/5 border-b border-destructive/20">
                    <p className="text-xs text-destructive">{rowError[p.id]}</p>
                  </div>
                )}

                {confirming === p.id && (
                  <div className="px-5 py-3 bg-green-500/5 border-b border-green-500/20 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground">Send {fmt(p.amountUsd)} in $GB to {truncate(p.walletAddress)}?</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Treasury wallet will sign and broadcast automatically.</p>
                    </div>
                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white shrink-0" disabled={isSending} onClick={() => doApprove(p.id)}>
                      {isSending ? "Sending..." : "Send $GB"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0" disabled={isSending} onClick={() => setConfirming(null)}>Cancel</Button>
                  </div>
                )}

                {rejecting === p.id && (
                  <div className="px-5 py-3 bg-destructive/5 border-b border-destructive/20 flex items-center gap-4">
                    <p className="text-xs text-muted-foreground flex-1">Reject {fmt(p.amountUsd)} payout to {p.email}?</p>
                    <Button size="sm" className="h-7 text-xs bg-destructive hover:bg-destructive/90 text-white shrink-0" onClick={() => doReject(p.id)}>Reject</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0" onClick={() => setRejecting(null)}>Cancel</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [token,      setToken]      = useState(() => sessionStorage.getItem(TOKEN_KEY) ?? "");
  const [tokenInput, setTokenInput] = useState("");
  const [authed,     setAuthed]     = useState(false);
  const [authError,  setAuthError]  = useState("");
  const [tab,        setTab]        = useState<Tab>("stats");
  const [overview,   setOverview]   = useState<Overview | null>(null);

  const fetchOverview = useCallback(async (tok: string) => {
    const r = await fetch(`${API_BASE}/overview`, { headers: { Authorization: `Admin ${tok}` } });
    if (r.status === 401) return null;
    return (await r.json()) as Overview;
  }, []);

  const signOut = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(""); setAuthed(false); setOverview(null);
  }, []);

  const tryAuth = async () => {
    setAuthError("");
    const ov = await fetchOverview(tokenInput.trim());
    if (!ov) { setAuthError("Invalid token"); return; }
    sessionStorage.setItem(TOKEN_KEY, tokenInput.trim());
    setToken(tokenInput.trim());
    setAuthed(true);
    setOverview(ov);
  };

  useEffect(() => {
    if (!token) return;
    fetchOverview(token).then(ov => {
      if (!ov) signOut();
      else { setAuthed(true); setOverview(ov); }
    });
  }, [token, fetchOverview, signOut]);

  // ── Login screen ──
  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-sm space-y-4 px-6">
          <div className="text-center space-y-1">
            <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase">Gigabee</p>
            <h1 className="text-xl font-semibold text-foreground">Admin access</h1>
            <p className="text-xs text-muted-foreground">Enter your admin token to continue.</p>
          </div>
          <div className="space-y-3">
            <Input
              type="password"
              placeholder="Admin token"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && tryAuth()}
              className="font-mono text-sm"
            />
            {authError && <p className="text-xs text-destructive">{authError}</p>}
            <Button className="w-full" onClick={tryAuth} disabled={!tokenInput.trim()}>
              Sign in
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/40 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">Gigabee Admin</span>
            {overview?.treasuryReady
              ? <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded px-2 py-0.5">Treasury ready</span>
              : <span className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-0.5">Treasury error</span>
            }
          </div>

          {/* Tab buttons */}
          <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
            <button
              onClick={() => setTab("stats")}
              className={`px-4 py-1.5 text-xs rounded-md transition-colors font-medium ${
                tab === "stats"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Network Stats
            </button>
            <button
              onClick={() => setTab("payouts")}
              className={`px-4 py-1.5 text-xs rounded-md transition-colors font-medium ${
                tab === "payouts"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Payouts
              {(overview?.pendingCount ?? 0) > 0 && (
                <span className="ml-1.5 bg-primary text-primary-foreground rounded-full px-1.5 py-px text-[10px] font-semibold">
                  {overview!.pendingCount}
                </span>
              )}
            </button>
          </div>

          <Button variant="ghost" size="sm" onClick={signOut} className="text-xs text-muted-foreground">
            Sign out
          </Button>
        </div>
      </div>

      {/* Treasury error banner */}
      {overview?.treasuryError && (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-5 py-3">
            <p className="text-xs font-medium text-destructive">Treasury key error: {overview.treasuryError}</p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8">
        {tab === "stats"   && <StatsTab   token={token} />}
        {tab === "payouts" && <PayoutsTab token={token} overview={overview} />}
      </div>
    </div>
  );
}
