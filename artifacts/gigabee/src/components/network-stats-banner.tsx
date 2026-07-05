import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetNetworkStats } from "@workspace/api-client-react";

const NAV_LINKS = [
  { href: "/chat",  label: "Chat"  },
  { href: "/earn",  label: "Earn"  },
  { href: "/earn",  label: "Honey", amber: true },
  { href: "/docs",  label: "Docs"  },
  { href: "/blog",  label: "Blog"  },
];

function AnimCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (value === prev.current) return;
    const diff = value - prev.current;
    const steps = 24;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplay(Math.round(prev.current + (diff / steps) * i));
      if (i >= steps) { clearInterval(id); prev.current = value; setDisplay(value); }
    }, 18);
    return () => clearInterval(id);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

function StatItem({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <span className="flex items-center gap-1 shrink-0">
      <span className={`font-mono font-semibold tabular-nums text-xs ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </span>
  );
}

const DOT = <span className="w-1 h-1 rounded-full bg-border/60 mx-1 shrink-0 inline-block" />;
const DIVIDER = <span className="w-px h-3 bg-border/60 mx-2 shrink-0 inline-block" />;

export function NetworkStatsBanner() {
  const { data, dataUpdatedAt, refetch } = useGetNetworkStats();
  const [location] = useLocation();

  useEffect(() => {
    const id = setInterval(() => { void refetch(); }, 10_000);
    return () => clearInterval(id);
  }, [refetch]);

  const [flash, setFlash] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (dataUpdatedAt === 0) return;
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 600);
    return () => clearTimeout(id);
  }, [dataUpdatedAt]);

  const tokens  = data?.tokensGenerated ?? 0;
  const workers = data?.workersOnline   ?? 0;
  const honey   = data?.honeyPaidOutUsd ?? 0;
  const jobs    = data?.jobsToday       ?? 0;

  return (
    <div className={`w-full border-b border-border/60 bg-card/50 backdrop-blur-sm transition-colors duration-500 ${flash ? "bg-primary/5" : ""}`}>
      <div className="max-w-7xl mx-auto px-4 h-8 flex items-center overflow-x-auto scrollbar-none gap-0">

        {/* Live pulse */}
        <span className="flex items-center gap-1.5 shrink-0 mr-3">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${workers > 0 ? "bg-primary" : "bg-muted-foreground"}`} />
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${workers > 0 ? "bg-primary" : "bg-muted-foreground"}`} />
          </span>
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">live</span>
        </span>

        {/* Stats */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 shrink-0">
            <span className="font-mono font-bold tabular-nums text-xs text-foreground">
              <AnimCount value={tokens} />
            </span>
            <span className="text-[11px] text-muted-foreground">tokens</span>
          </span>

          {DOT}
          <StatItem label="workers" value={<AnimCount value={workers} />} highlight={workers > 0} />
          {DOT}
          <StatItem label="jobs/hr" value={<AnimCount value={jobs} />} />
          {DOT}
          <StatItem
            label="honey"
            value={honey >= 1000
              ? `$${(honey / 1000).toFixed(1)}k`
              : `$${honey.toFixed(2)}`}
            highlight={honey > 0}
          />
        </div>

        {DIVIDER}

        {/* Nav links */}
        <nav className="flex items-center gap-0.5 shrink-0">
          {NAV_LINKS.map(({ href, label, amber }) => {
            const active = location === href || (href !== "/" && location.startsWith(href));
            return (
              <Link
                key={label}
                href={href}
                className={`px-2.5 py-0.5 text-xs rounded transition-colors ${
                  active
                    ? amber
                      ? "text-primary font-medium"
                      : "text-foreground font-medium"
                    : amber
                      ? "text-primary/70 hover:text-primary"
                      : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Spacer */}
        <span className="flex-1" />

        {/* Timestamp */}
        {dataUpdatedAt > 0 && (
          <span className="hidden lg:block text-[10px] font-mono text-muted-foreground/50 shrink-0">
            {new Date(dataUpdatedAt).toLocaleTimeString("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })} UTC
          </span>
        )}
      </div>
    </div>
  );
}
