import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useGetNetworkStats } from "@workspace/api-client-react";
import { BeeLogo } from "@/components/icons";
import { ArrowLeft } from "lucide-react";

const MODEL_LABEL: Record<string, string> = {
  "bee-nano":  "Bee Nano",
  "bee-glide": "Bee Glide",
  "hive-dal":  "Bee DAL",
};

const HIDDEN_MODELS = new Set(["bee-hover"]);

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimCount({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (value === prev.current) return;
    const diff  = value - prev.current;
    const steps = 40;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplay(Math.round(prev.current + (diff / steps) * i));
      if (i >= steps) { clearInterval(id); prev.current = value; setDisplay(value); }
    }, 16);
    return () => clearInterval(id);
  }, [value]);

  return <span className={className}>{display.toLocaleString()}</span>;
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function LiveCard({ label, value, sub, active }: {
  label: string; value: React.ReactNode; sub?: string; active?: boolean;
}) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card/50">
      <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
      <div className="flex items-center gap-2">
        {active && (
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
        )}
        <p className="text-2xl font-mono font-bold text-foreground tabular-nums">{value}</p>
      </div>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ─── Custom bar tooltip ───────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number; name: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-border bg-card rounded-lg px-3 py-2 text-xs">
      <p className="font-mono text-muted-foreground mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="font-mono text-foreground">
          {p.name}: <span className="text-primary font-semibold">{p.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-4">{title}</p>
      {children}
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const { data, dataUpdatedAt, refetch } = useGetNetworkStats();

  useEffect(() => {
    const id = setInterval(() => { void refetch(); }, 10_000);
    return () => clearInterval(id);
  }, [refetch]);

  const tokens  = data?.tokensGenerated ?? 0;
  const workers = data?.workersOnline   ?? 0;
  const honey   = data?.honeyPaidOutUsd ?? 0;
  const jobs    = data?.jobsToday       ?? 0;
  const models  = data?.activeModels    ?? 0;
  const daily   = data?.daily   ?? [];
  const byModel = data?.byModel ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Minimal top bar ───────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
              <ArrowLeft className="h-3.5 w-3.5" />
              <BeeLogo className="h-4 w-4" />
              <span className="font-serif">Gigabee</span>
            </Link>
            <span className="w-px h-4 bg-border/60" />
            <span className="text-sm font-medium text-foreground">Network Stats</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${workers > 0 ? "bg-primary" : "bg-muted-foreground"}`} />
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${workers > 0 ? "bg-primary" : "bg-muted-foreground"}`} />
            </span>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">live</span>
            {dataUpdatedAt > 0 && (
              <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground/50 ml-2">
                {new Date(dataUpdatedAt).toLocaleTimeString("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })} UTC
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-14">

        {/* ── Hero: token counter ────────────────────────────────────────── */}
        <div>
          <AnimCount
            value={tokens}
            className="block text-6xl sm:text-7xl lg:text-8xl font-mono font-bold text-foreground tabular-nums leading-none"
          />
          <p className="text-sm text-muted-foreground mt-3 font-mono">tokens generated by the network</p>
        </div>

        {/* ── Live cards ────────────────────────────────────────────────── */}
        <Section title="live">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
            <LiveCard label="workers online" value={<AnimCount value={workers} />}           active={workers > 0} />
            <LiveCard label="jobs this hour" value={<AnimCount value={jobs} />} />
            <LiveCard label="active models"  value={<AnimCount value={models} />} />
            <LiveCard
              label="honey paid"
              value={honey >= 1000
                ? `$${(honey / 1000).toFixed(2)}k`
                : `$${honey.toFixed(2)}`}
              sub="total $GB paid to workers"
              active={honey > 0}
            />
            <LiveCard
              label="avg tokens/job"
              value={jobs > 0 ? Math.round(tokens / Math.max(jobs, 1)).toLocaleString() : "—"}
              sub="all-time average"
            />
          </div>
        </Section>

        {/* ── Network charts ────────────────────────────────────────────── */}
        <Section title="network">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Jobs per day */}
            <div className="border border-border rounded-lg overflow-hidden bg-card/30">
              <div className="px-4 pt-4 pb-1">
                <p className="text-xs font-mono text-muted-foreground">jobs per day</p>
              </div>
              <div className="px-3 pb-4">
                {daily.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">no data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={daily} margin={{ top: 8, right: 4, bottom: 0, left: -28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontFamily: "monospace" }} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="jobs" name="jobs" fill="hsl(var(--foreground))" radius={[2, 2, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Tokens per day */}
            <div className="border border-border rounded-lg overflow-hidden bg-card/30">
              <div className="px-4 pt-4 pb-1">
                <p className="text-xs font-mono text-muted-foreground">tokens generated per day</p>
              </div>
              <div className="px-3 pb-4">
                {daily.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">no data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={daily} margin={{ top: 8, right: 4, bottom: 0, left: -28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontFamily: "monospace" }} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontFamily: "monospace" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="tokens" name="tokens" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </Section>

        {/* ── By model ──────────────────────────────────────────────────── */}
        {byModel.filter(r => !HIDDEN_MODELS.has(r.model)).length > 0 && (
          <Section title="models">
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-4 px-5 py-2 bg-muted/20 text-[11px] font-mono text-muted-foreground uppercase tracking-wide">
                <span>Model</span>
                <span className="text-right">Jobs</span>
                <span className="text-right">Tokens</span>
                <span className="text-right">Tokens/job</span>
              </div>
              {byModel.filter(r => !HIDDEN_MODELS.has(r.model)).map((row, i) => (
                <div
                  key={row.model}
                  className={`grid grid-cols-4 px-5 py-3.5 items-center ${i < byModel.length - 1 ? "border-b border-border/50" : ""}`}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{MODEL_LABEL[row.model] ?? row.model}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">{row.model}</p>
                  </div>
                  <p className="font-mono text-sm text-right text-foreground">{row.jobs.toLocaleString()}</p>
                  <p className="font-mono text-sm text-right text-muted-foreground">{row.tokens.toLocaleString()}</p>
                  <p className="font-mono text-sm text-right text-primary">
                    {row.jobs > 0 ? Math.round(row.tokens / row.jobs).toLocaleString() : "—"}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Footer note ───────────────────────────────────────────────── */}
        <p className="text-[11px] font-mono text-muted-foreground/50 pb-4">
          stats refresh every 10s · all times UTC · jobs counted in current hour window
        </p>
      </div>
    </div>
  );
}
