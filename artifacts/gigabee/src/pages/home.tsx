import { useState, useEffect, useRef, FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { io } from "socket.io-client";
import { useGetNetworkStats } from "@workspace/api-client-react";
import { getSessionToken } from "@/lib/socket";
import { BeeLogo, HoneycombBg, HexBadge } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Send,
  Menu,
  X,
  Github,
  Users,
  Monitor,
  Lock,
  FileText,
  Trash2,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";

// ─── tiny inline X (Twitter) social icon ────────────────────────────────────
function XSocialIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.733-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

// ─── Scroll-triggered fade hook ─────────────────────────────────────────────
function useFadeIn(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return {
    ref,
    style: visible
      ? { animation: `bento-fade-up 0.45s ease both`, animationDelay: `${delay}ms` } as React.CSSProperties
      : { opacity: 0 } as React.CSSProperties,
  };
}

// ─── Bento card wrapper ──────────────────────────────────────────────────────
function BentoCard({
  className = "",
  delay = 0,
  children,
}: {
  className?: string;
  delay?: number;
  children: React.ReactNode;
}) {
  const { ref, style } = useFadeIn(delay);
  return (
    <div
      ref={ref}
      style={style}
      className={`
        rounded-[14px] border border-border bg-card p-6 flex flex-col gap-4
        transition-all duration-150 hover:-translate-y-0.5 hover:border-foreground/20
        hover:shadow-sm
        ${className}
      `}
    >
      {children}
    </div>
  );
}

// ─── Economy card wrapper (reuses useFadeIn, no illustration inside) ─────────
function FadeUpCard({
  delay = 0,
  className = "",
  children,
}: {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const { ref, style } = useFadeIn(delay);
  return (
    <div ref={ref} style={style} className={className}>
      {children}
    </div>
  );
}

// ─── Illustration: People-powered AI ────────────────────────────────────────
function IllustrationPeople() {
  return (
    <div className="flex items-center justify-between gap-2 mt-auto pt-2">
      {/* Users */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-8 h-8 hex-clip bg-secondary/70 flex items-center justify-center"
            style={{ animation: "bento-fade-up 0.35s ease both", animationDelay: `${i * 80}ms` }}
          >
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        ))}
      </div>
      {/* Dashed connector left (Users → Hive) */}
      <div className="flex-1 flex items-center relative overflow-hidden">
        <div className="w-full border-t-2 border-dashed border-primary/40" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary/60 -ml-px shrink-0" />
        <span
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary"
          style={{ animation: "bento-slide-dot 2.4s ease-in-out infinite", animationDelay: "0.4s", left: "-6px" }}
        />
      </div>
      {/* Hive hexagon */}
      <div className="w-11 h-11 hex-clip bg-primary/20 flex items-center justify-center shrink-0 relative">
        <span
          className="absolute inset-0 bg-primary/25"
          style={{ animation: "bento-glow-ring 2.4s ease-in-out infinite", animationDelay: "1.6s" }}
        />
        <BeeLogo className="h-5 w-5 relative z-10" />
      </div>
      {/* Dashed connector right (Hive → Workers) */}
      <div className="flex-1 flex items-center relative overflow-hidden">
        <div className="w-1.5 h-1.5 rounded-full bg-primary/60 -mr-px shrink-0" />
        <div className="w-full border-t-2 border-dashed border-primary/40" />
        <span
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary"
          style={{ animation: "bento-slide-dot 2.4s ease-in-out infinite", animationDelay: "1.6s", left: "-6px" }}
        />
      </div>
      {/* Workers */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-8 h-8 hex-clip bg-secondary/70 flex items-center justify-center"
            style={{ animation: "bento-fade-up 0.35s ease both", animationDelay: `${700 + i * 80}ms` }}
          >
            <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Illustration: Private by design ────────────────────────────────────────
function IllustrationPrivacy() {
  const [phase, setPhase] = useState(0); // 0=hidden, 1=PROMPT, 2=+SEALED, 3=+GONE

  useEffect(() => {
    let alive = true;
    async function loop() {
      await new Promise<void>(r => setTimeout(r, 300));
      while (alive) {
        for (let i = 1; i <= 3; i++) {
          await new Promise<void>(r => setTimeout(r, 520));
          if (!alive) return;
          setPhase(i);
        }
        await new Promise<void>(r => setTimeout(r, 2200));
        if (!alive) return;
        setPhase(0);
        await new Promise<void>(r => setTimeout(r, 350));
      }
    }
    loop();
    return () => { alive = false; };
  }, []);

  const show = (minPhase: number): React.CSSProperties => ({
    opacity: phase >= minPhase ? 1 : 0,
    transform: phase >= minPhase ? "translateY(0)" : "translateY(5px)",
    transition: "opacity 0.32s ease, transform 0.32s ease",
  });

  return (
    <div className="flex items-center justify-between gap-2 mt-auto pt-2">
      <div className="flex flex-col items-center gap-1" style={show(1)}>
        <div className="w-9 h-9 hex-clip bg-secondary/70 flex items-center justify-center">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">PROMPT</span>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-border shrink-0" style={show(2)} />
      <div className="flex flex-col items-center gap-1" style={show(2)}>
        <div className="w-9 h-9 hex-clip bg-primary/20 flex items-center justify-center relative">
          {phase >= 2 && (
            <span
              className="absolute inset-0 bg-primary/30"
              style={{ animation: "bento-glow-ring 2s ease-in-out infinite" }}
            />
          )}
          <Lock className="h-4 w-4 text-primary relative z-10" />
        </div>
        <span className="text-[10px] text-primary font-mono">SEALED</span>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-border shrink-0" style={show(3)} />
      <div className="flex flex-col items-center gap-1" style={show(3)}>
        <div className="w-9 h-9 hex-clip bg-secondary/70 flex items-center justify-center">
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">GONE</span>
      </div>
    </div>
  );
}

// ─── Illustration: In-browser terminal ──────────────────────────────────────
function IllustrationTerminal() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    async function loop() {
      await new Promise<void>(r => setTimeout(r, 500));
      while (alive) {
        for (let i = 1; i <= 3; i++) {
          await new Promise<void>(r => setTimeout(r, 680));
          if (!alive) return;
          setCount(i);
        }
        await new Promise<void>(r => setTimeout(r, 2400));
        if (!alive) return;
        setCount(0);
        await new Promise<void>(r => setTimeout(r, 350));
      }
    }
    loop();
    return () => { alive = false; };
  }, []);

  const lines = [
    { prompt: "text-green-500", label: "text-muted-foreground",       text: "worker online"  },
    { prompt: "text-primary",   label: "text-muted-foreground",       text: "serving job…"   },
    { prompt: "text-primary",   label: "text-primary font-medium",    text: "+$0.09 honey"   },
  ];

  return (
    <div className="mt-auto pt-2">
      <div className="rounded-lg bg-background border border-border p-3 font-mono text-xs min-h-[74px] flex flex-col gap-1.5">
        {lines.slice(0, count).map(({ prompt, label, text }, i) => (
          <div key={i} className="flex items-center gap-2" style={{ animation: "bento-fade-up 0.2s ease both" }}>
            <span className={prompt}>▸</span>
            <span className={label}>{text}</span>
          </div>
        ))}
        {count < 3 && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground/30">▸</span>
            <span className="inline-block w-[6px] h-[11px] bg-muted-foreground/35 rounded-[1px] animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Illustration: Get paid bar chart ───────────────────────────────────────
function IllustrationBars() {
  const [phase, setPhase] = useState(0); // 0 = all hidden, 1/2/3 = bars revealed in order

  useEffect(() => {
    let alive = true;
    async function loop() {
      await new Promise<void>(r => setTimeout(r, 400));
      while (alive) {
        for (let i = 1; i <= 3; i++) {
          await new Promise<void>(r => setTimeout(r, 480));
          if (!alive) return;
          setPhase(i);
        }
        await new Promise<void>(r => setTimeout(r, 2200));
        if (!alive) return;
        setPhase(0);
        await new Promise<void>(r => setTimeout(r, 380));
      }
    }
    loop();
    return () => { alive = false; };
  }, []);

  const bars = [
    { label: "JOB",   labelClass: "text-muted-foreground", barClass: "bg-secondary border-border",    heightPx: 24, idx: 0 },
    { label: "HONEY", labelClass: "text-primary",           barClass: "bg-primary border-primary/60", heightPx: 40, idx: 1 },
    { label: "REF",   labelClass: "text-muted-foreground", barClass: "bg-secondary border-border",    heightPx: 32, idx: 2 },
  ];

  return (
    <div className="mt-auto pt-2 flex items-end justify-center gap-3 h-14">
      {bars.map(({ label, labelClass, barClass, heightPx, idx }) => (
        <div key={label} className="flex flex-col items-center gap-1">
          <div
            className={`w-9 rounded-t-md border ${barClass}`}
            style={{
              height: `${heightPx}px`,
              transformOrigin: "bottom",
              transform: phase > idx ? "scaleY(1)" : "scaleY(0)",
              transition: "transform 0.5s cubic-bezier(0.22,1,0.36,1)",
            }}
          />
          <span className={`text-[10px] font-mono ${labelClass}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function Home() {
  const [, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroInput, setHeroInput] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [caCopied, setCaCopied] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  const CA = "7NcMKMrXPBVCWPcs9SSqnF6ZGy5neAtzTZpFqZqLquaP";
  function copyCA() {
    navigator.clipboard.writeText(CA);
    setCaCopied(true);
    setTimeout(() => setCaCopied(false), 2000);
  }

  useEffect(() => {
    if (!statsOpen) return;
    function onOutside(e: MouseEvent) {
      if (statsRef.current && !statsRef.current.contains(e.target as Node)) {
        setStatsOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [statsOpen]);
  // REST fallback — refetches every 5 s so stats stay fresh even without a socket
  const { data: stats, refetch: refetchStats } = useGetNetworkStats();

  // Live worker count pushed by the public /stats socket (no auth required)
  const [liveWorkersOnline, setLiveWorkersOnline] = useState<number | null>(null);

  useEffect(() => {
    // Poll REST every 5 s as fallback (covers page-load before first socket push)
    const pollId = setInterval(() => void refetchStats(), 5_000);

    // Real-time push via public /stats namespace — no auth required
    const socket = io("/stats", {
      path: "/api/socket.io",
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 2_000,
      reconnectionDelayMax: 30_000,
    });
    socket.on("stats:network", ({ workersOnline }: { workersOnline: number }) => {
      setLiveWorkersOnline(workersOnline);
    });

    return () => {
      clearInterval(pollId);
      socket.disconnect();
    };
  }, [refetchStats]);

  // Socket value is authoritative (sub-second); REST is fallback for first render
  const workersOnline = liveWorkersOnline ?? stats?.workersOnline;

  const heroInputRef = useRef<HTMLInputElement>(null);
  const isLoggedIn = !!getSessionToken();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleHeroSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = heroInput.trim();
    if (!trimmed) {
      heroInputRef.current?.focus();
      return;
    }
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }
    try { sessionStorage.setItem("gigabee-hero-draft", trimmed); } catch {}
    navigate("/chat");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">

      {/* ── Floating pill nav ─────────────────────────────────────────────── */}
      <div className="fixed top-0 inset-x-0 z-50 flex justify-center px-4 pt-4">
        <header
          className={`
            w-full max-w-[1080px] flex items-center justify-between h-14 px-4
            rounded-[14px] border border-border bg-card/95
            transition-shadow duration-200
            ${scrolled ? "shadow-lg backdrop-blur-md" : "shadow-sm"}
          `}
          data-testid="site-nav"
        >
          {/* Left: logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0" data-testid="link-home">
            <BeeLogo className="h-5 w-5" />
            <span className="font-serif font-medium text-foreground text-sm">Gigabee</span>
          </Link>

          {/* Center: links (desktop) */}
          <nav className="hidden md:flex items-center gap-5 text-sm">
            <Link href="/chat" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-chat">Chat</Link>
            <Link href="/earn" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-earn">Earn</Link>
            <Link href="/earn" className="text-primary hover:text-primary/80 transition-colors font-medium" data-testid="link-nav-honey">Honey</Link>
            <Link href="/docs" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-docs">Docs</Link>
            <Link href="/blog" className="text-muted-foreground hover:text-foreground transition-colors">Blog</Link>
            {/* Stats chip + dropdown */}
            <div ref={statsRef} className="relative">
              <button
                onClick={() => setStatsOpen(o => !o)}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="btn-nav-stats"
              >
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${(workersOnline ?? 0) > 0 ? "bg-primary" : "bg-muted-foreground"}`} />
                  <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${(workersOnline ?? 0) > 0 ? "bg-primary" : "bg-muted-foreground"}`} />
                </span>
                <span className="text-xs font-medium">Stats</span>
              </button>

              {statsOpen && (
                <div className="absolute top-full right-0 mt-3 w-72 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${(workersOnline ?? 0) > 0 ? "bg-primary" : "bg-muted-foreground"}`} />
                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${(workersOnline ?? 0) > 0 ? "bg-primary" : "bg-muted-foreground"}`} />
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">live network</span>
                    </div>
                    <Link href="/stats" onClick={() => setStatsOpen(false)} className="text-[11px] text-primary hover:text-primary/80 font-mono transition-colors">
                      full stats →
                    </Link>
                  </div>

                  {/* Token hero */}
                  <div className="px-4 py-4 border-b border-border/60">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">tokens generated</p>
                    <p className="text-3xl font-mono font-bold text-foreground tabular-nums">
                      {stats?.tokensGenerated != null ? stats.tokensGenerated.toLocaleString() : "—"}
                    </p>
                  </div>

                  {/* Stat grid */}
                  <div className="grid grid-cols-2 gap-px bg-border/40">
                    {[
                      { label: "workers online",  value: workersOnline?.toLocaleString() ?? "—",  highlight: (workersOnline ?? 0) > 0 },
                      { label: "jobs this hour",  value: stats?.jobsToday?.toLocaleString() ?? "—" },
                      { label: "active models",   value: stats?.activeModels?.toLocaleString() ?? "—" },
                      {
                        label: "honey paid",
                        value: stats?.honeyPaidOutUsd != null
                          ? stats.honeyPaidOutUsd >= 1000
                            ? `$${(stats.honeyPaidOutUsd / 1000).toFixed(1)}k`
                            : `$${stats.honeyPaidOutUsd.toFixed(2)}`
                          : "—",
                        highlight: (stats?.honeyPaidOutUsd ?? 0) > 0,
                      },
                    ].map(item => (
                      <div key={item.label} className="bg-card px-4 py-3">
                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide mb-1">{item.label}</p>
                        <p className={`text-base font-mono font-semibold tabular-nums ${item.highlight ? "text-primary" : "text-foreground"}`}>
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Right: icons + CTA (desktop) */}
          <div className="hidden md:flex items-center gap-3">
            <a href="https://github.com/mr-gigabee" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors p-1" aria-label="GitHub">
              <Github className="h-4 w-4" />
            </a>
            <a href="https://x.com/Gigabee_" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors p-1" aria-label="X (Twitter)">
              <XSocialIcon className="h-3.5 w-3.5" />
            </a>
            {isLoggedIn ? (
              <Link href="/chat">
                <Button size="sm" className="h-8 px-4 text-xs font-medium" data-testid="btn-open-chat">Open Chat</Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button size="sm" className="h-8 px-4 text-xs font-medium" data-testid="btn-login">Sign in</Button>
              </Link>
            )}
          </div>

          {/* Mobile: hamburger */}
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            data-testid="btn-mobile-menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>
      </div>

      {/* ── Mobile menu ───────────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[72px] z-40 bg-background/95 backdrop-blur-sm flex flex-col p-6 gap-1 md:hidden" data-testid="mobile-menu">
          {[
            { href: "/chat", label: "Chat" },
            { href: "/earn", label: "Earn" },
            { href: "/earn", label: "Honey", amber: true },
            { href: "/docs", label: "Docs" },
            { href: "/blog", label: "Blog" },
          ].map(({ href, label, amber }) => (
            <Link
              key={label}
              href={href}
              className={`py-3 px-2 text-base border-b border-border/40 ${amber ? "text-primary font-medium" : "text-foreground"}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
          <Link href="/login" className="mt-4">
            <Button className="w-full" onClick={() => setMobileMenuOpen(false)}>Log in</Button>
          </Link>
        </div>
      )}

      <main className="flex-1">
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative flex flex-col items-center justify-center min-h-[70vh] pt-32 pb-20 px-4 overflow-hidden">
          {/* Honeycomb background pattern */}
          <HoneycombBg id="hc-hero" className="text-foreground opacity-[0.07]" />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center text-center w-full max-w-[1080px] mx-auto">
            {/* Bee emblem visible on mobile where nav logo is small */}
            <div className="mb-4 md:hidden">
              <BeeLogo className="h-10 w-10" />
            </div>

            {/* H1 */}
            <h1 className="font-serif text-[36px] md:text-[56px] font-medium leading-[1.15] tracking-tight mb-4 honey-text">
              Gigabee
            </h1>

            {/* Tagline */}
            <p className="text-base text-muted-foreground mb-8">
              AI powered by the hive, not the data center.
            </p>

            {/* Hero input */}
            <form
              onSubmit={handleHeroSubmit}
              className="w-full max-w-[560px] flex items-center gap-0 rounded-[14px] border border-border bg-card shadow-sm overflow-hidden focus-within:border-primary/50 transition-colors mb-5"
            >
              <input
                ref={heroInputRef}
                type="text"
                value={heroInput}
                onChange={(e) => setHeroInput(e.target.value)}
                placeholder="Ask Bee anything..."
                className="flex-1 h-12 px-4 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0"
                data-testid="hero-input"
              />
              <button
                type="submit"
                className="h-12 w-12 shrink-0 flex items-center justify-center bg-primary hover:bg-primary/90 transition-colors"
                aria-label="Send"
                data-testid="btn-hero-send"
              >
                <Send className="h-4 w-4 text-primary-foreground" />
              </button>
            </form>

            {/* Subline */}
            <p className="text-[13px] text-muted-foreground max-w-[460px] leading-relaxed mb-8">
              A decentralized network where anyone can share compute and earn Honey, while users get private AI that never stores a prompt.
            </p>

            {/* Live workers pill — updates in real-time via public socket */}
            {workersOnline != null && (
              <div
                className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card px-4 py-2 text-sm"
                data-testid="workers-pill"
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-green-400/60 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                <span className="font-mono text-foreground">
                  {workersOnline.toLocaleString()}
                </span>
                <span className="text-muted-foreground">workers online</span>
              </div>
            )}

            {/* $GB Contract Address */}
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-xs">
              <span className="font-semibold text-primary shrink-0">$GB</span>
              <span className="font-mono text-muted-foreground hidden sm:inline select-all">
                {CA}
              </span>
              <span className="font-mono text-muted-foreground sm:hidden select-all">
                {CA.slice(0, 8)}…{CA.slice(-6)}
              </span>
              <button
                onClick={copyCA}
                className="ml-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Copy contract address"
              >
                {caCopied
                  ? <Check className="h-3.5 w-3.5 text-green-400" />
                  : <Copy className="h-3.5 w-3.5" />
                }
              </button>
            </div>
          </div>
        </section>

        {/* ── Bento grid ────────────────────────────────────────────────────── */}
        <section className="px-4 pb-20 max-w-[1080px] mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Row 1 wide + narrow */}
            {/* Card 1: People-powered AI (2/3 width) */}
            <BentoCard className="md:col-span-2" delay={0}>
              <div>
                <h3 className="font-serif text-lg font-medium text-foreground mb-1">People-powered AI</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  No data centers. Just people around the world sharing compute to power AI for everyone.
                </p>
              </div>
              <IllustrationPeople />
            </BentoCard>

            {/* Card 2: Private by design (1/3 width) */}
            <BentoCard delay={120}>
              <div>
                <h3 className="font-serif text-lg font-medium text-foreground mb-1">Private by design</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We never store your prompts, and workers never see who you are.
                </p>
              </div>
              <IllustrationPrivacy />
            </BentoCard>

            {/* Row 2 narrow + wide */}
            {/* Card 3: In-browser (1/3 width) */}
            <BentoCard delay={0}>
              <div>
                <h3 className="font-serif text-lg font-medium text-foreground mb-1">In-browser</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  No downloads. Just open and go.
                </p>
              </div>
              <IllustrationTerminal />
            </BentoCard>

            {/* Card 4: Get paid for your compute (2/3 width) */}
            <BentoCard className="md:col-span-2" delay={120}>
              <div>
                <h3 className="font-serif text-lg font-medium text-foreground mb-1">Get paid for your compute</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Earn Honey in USDC for every job your GPU serves, plus for evaluating, creating, and referring.
                </p>
              </div>
              <IllustrationBars />
            </BentoCard>
          </div>
        </section>

        {/* ── The Honey economy ─────────────────────────────────────────────── */}
        <section className="px-4 py-20 border-t border-border relative overflow-hidden">
          <HoneycombBg id="hc-economy" className="text-primary opacity-[0.045]" />
          <div className="max-w-[1080px] mx-auto w-full relative z-10">
            {/* Header */}
            <div className="text-center mb-12">
              <h2 className="font-serif text-[32px] font-medium text-foreground mb-3">
                The Honey economy
              </h2>
              <p className="text-[15px] text-muted-foreground max-w-[460px] mx-auto leading-relaxed">
                Every dollar of Honey is funded by real usage. No token, no emissions. The books are public.
              </p>
            </div>

            {/* Three numbered cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
              {[
                {
                  num: "01",
                  title: "Usage funds the pool",
                  body: "Every paid message and API call flows into one revenue pool, in USDC.",
                },
                {
                  num: "02",
                  title: "The Hive keeps 75%",
                  body: "Workers earn 75% of every job they serve. Evaluators, creators, and referrers share the rest.",
                },
                {
                  num: "03",
                  title: "Withdraw anytime",
                  body: "Honey pays out in USDC. Earnings are tracked on-chain. Payouts launching soon.",
                },
              ].map(({ num, title, body }, i) => (
                <FadeUpCard
                  key={num}
                  delay={i * 110}
                  className="rounded-[14px] border border-border bg-card p-6 space-y-3 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-sm transition-all duration-150"
                >
                  <HexBadge size="sm" variant="primary">
                    <span className="font-mono text-[11px] font-bold leading-none">{num}</span>
                  </HexBadge>
                  <h3 className="font-serif text-base font-medium text-foreground">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </FadeUpCard>
              ))}
            </div>

            {/* Closing line */}
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Real usage funds the hive. AI for the people, by the people.
              </p>
              <Link href="/docs">
                <button className="text-sm text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1">
                  Learn how Honey works
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Developer API ─────────────────────────────────────────────────── */}
      <section className="px-4 py-20 border-t border-border">
        <div className="max-w-[1080px] mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left: copy */}
            <FadeUpCard delay={0}>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-medium mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live API — available now
              </div>
              <h2 className="font-serif text-[28px] font-medium text-foreground mb-3 leading-tight">
                Build with Bee
              </h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
                OpenAI-compatible API. Point your existing SDK at{" "}
                <code className="text-foreground font-mono text-sm bg-secondary px-1.5 py-0.5 rounded">gigabee.io/api/v1</code>{" "}
                — no other changes needed. Same pricing as the chat interface.
              </p>
              <div className="flex gap-3">
                <Link href="/docs#api">
                  <Button size="sm" className="h-8 px-4 text-xs font-medium">
                    API reference
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
                <Link href="/earn">
                  <Button size="sm" variant="outline" className="h-8 px-4 text-xs font-medium">
                    Get API key
                  </Button>
                </Link>
              </div>
            </FadeUpCard>

            {/* Right: code snippet */}
            <FadeUpCard delay={120}>
              <div className="rounded-xl bg-background border border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                  <span className="ml-2 text-xs text-muted-foreground font-mono">bee.sh</span>
                </div>
                <pre className="p-4 text-xs font-mono text-foreground overflow-x-auto leading-relaxed">
                  <code>{`curl gigabee.io/api/v1/chat/completions \\
  -H "Authorization: Bearer giga_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "bee-hover",
    "messages": [
      {"role":"user","content":"Hello, Bee!"}
    ]
  }'`}</code>
                </pre>
              </div>
            </FadeUpCard>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-[1080px] mx-auto px-4 py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <BeeLogo className="h-5 w-5" />
              <span className="font-serif font-medium text-foreground">Gigabee</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px]">
              AI infrastructure for the people. Decentralized inference on contributor GPUs worldwide.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase mb-4">Product</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link href="/" className="hover:text-foreground transition-colors">Home</Link></li>
              <li><Link href="/chat" className="hover:text-foreground transition-colors">Chat</Link></li>
              <li><Link href="/earn" className="hover:text-foreground transition-colors">Earn</Link></li>
              <li><Link href="/docs" className="hover:text-foreground transition-colors">Docs</Link></li>
              <li><Link href="/join" className="hover:text-foreground transition-colors">Referrals</Link></li>
              <li><Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link></li>
            </ul>
          </div>

          {/* Honey */}
          <div>
            <h4 className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase mb-4">Honey</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link href="/docs" className="hover:text-foreground transition-colors">How it works</Link></li>
              <li><Link href="/docs#worker-setup" className="hover:text-foreground transition-colors">Worker setup</Link></li>
              <li><Link href="/earn" className="hover:text-foreground transition-colors">Earnings</Link></li>
              <li><Link href="/earn" className="hover:text-foreground transition-colors">Payouts</Link></li>
              <li><Link href="/join" className="hover:text-foreground transition-colors">Referral program</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase mb-4">Resources</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link href="/docs" className="hover:text-foreground transition-colors">Documentation</Link></li>
              <li><Link href="/docs" className="hover:text-foreground transition-colors">API reference</Link></li>
              <li><Link href="/docs" className="hover:text-foreground transition-colors">Pricing</Link></li>
              <li><Link href="/docs" className="hover:text-foreground transition-colors">Roadmap</Link></li>
              <li>
                <a href="https://x.com/Gigabee_" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">X (Twitter)</a>
              </li>
              <li>
                <a href="https://github.com/mr-gigabee" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border max-w-[1080px] mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Gigabee.io</span>
          <div className="flex gap-5">
            <Link href="/docs" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/docs" className="hover:text-foreground transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
