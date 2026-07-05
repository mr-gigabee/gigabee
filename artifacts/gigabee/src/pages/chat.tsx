import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useGetCreditsBalance,
  useCreateChatCompletion,
  useListChatJobs,
  getGetCreditsBalanceQueryKey,
  getListChatJobsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BeeLogo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Send,
  ChevronRight,
  ChevronLeft,
  Square,
  TrendingUp,
  BookOpen,
  Trash2,
  LogOut,
  Coins,
  Paperclip,
  Code2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { connectSocket, clearSessionToken, disconnectSocket } from "@/lib/socket";
import { BuyCreditsModal } from "@/components/buy-credits-modal";
import type { Socket } from "socket.io-client";
import type { Components } from "react-markdown";

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold mt-4 mb-2 text-foreground leading-tight">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold mt-4 mb-2 text-foreground leading-snug">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mt-3 mb-1.5 text-foreground">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 leading-relaxed text-sm text-foreground">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-3 space-y-1 text-sm text-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-3 space-y-1 text-sm text-foreground">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    return isBlock ? (
      <code className={`block bg-muted/80 border border-border/50 rounded-lg px-4 py-3 mb-3 overflow-x-auto text-xs font-mono whitespace-pre text-foreground ${className ?? ""}`}>
        {children}
      </code>
    ) : (
      <code className="bg-muted/80 border border-border/40 px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <div className="mb-1">{children}</div>,
  strong: ({ children }) => (
    <strong className="font-bold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="border-border/60 my-4" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-[3px] border-primary/50 pl-4 my-3 text-muted-foreground italic text-sm">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => (
    <a className="text-primary underline underline-offset-2 hover:opacity-80" href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <span className="block my-3">
      <img
        src={src}
        alt={alt ?? "Generated image"}
        className="rounded-xl max-w-full border border-border/40 shadow-md"
        style={{ maxHeight: 480 }}
      />
    </span>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border/60 px-3 py-1.5 bg-muted/60 font-semibold text-left text-xs">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-border/60 px-3 py-1.5 text-sm">{children}</td>
  ),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  workerId?: string;
  tokensUsed?: number;
  creditsSpent?: number;
  attachedImageUrl?: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  updatedAt: number;
};

type Model = "bee-nano" | "bee-hover" | "bee-glide";

const MODEL_INFO: Record<Model, { label: string; cost: number; description: string }> =
  {
    "bee-nano": {
      label: "Bee Nano",
      cost: 5,
      description: "~0.5B · Instant · Browser GPU",
    },
    "bee-hover": {
      label: "Bee Hover",
      cost: 10,
      description: "~8B · Fast · Browser GPU",
    },
    "bee-glide": {
      label: "Bee Glide",
      cost: 15,
      description: "~27B · Smarter · Native GPU",
    },
  };

// ---------------------------------------------------------------------------
// Conversation persistence (localStorage)
// ---------------------------------------------------------------------------

function loadConversations(key: string): Conversation[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function saveConversations(key: string, convs: Conversation[]) {
  localStorage.setItem(key, JSON.stringify(convs));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Chat() {
  const storageKey = "gigabee-conversations";

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [model, setModel] = useState<Model>("bee-hover");
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 768,
  );
  const [, navigate] = useLocation();

  // Socket streaming state
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Composer feature state
  const [attachedImage, setAttachedImage] = useState<{ file: File; url: string } | null>(null);
  const [codeMode, setCodeMode] = useState(false);
  const [imageGenOpen, setImageGenOpen] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imgGenConsent, setImgGenConsent] = useState(
    () => typeof window !== "undefined" && !!localStorage.getItem("gigabee-imggen-consent-v1"),
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load conversations scoped to the connected wallet
  useEffect(() => {
    const stored = loadConversations(storageKey);
    setConversations(stored);
    setActiveId(stored[0]?.id ?? null);
  }, [storageKey]);

  // Read hero-input draft forwarded from the landing page
  useEffect(() => {
    try {
      const draft = sessionStorage.getItem("gigabee-hero-draft");
      if (draft) {
        sessionStorage.removeItem("gigabee-hero-draft");
        setInput(draft);
        textareaRef.current?.focus();
      }
    } catch {
      // ignore
    }
  }, []);
  const streamContextRef = useRef<{
    convId: string;
    msgs: ChatMessage[];
    convList: Conversation[];
    model: string;
    jobId: string;
    fullText: string;
  } | null>(null);
  const queryClient = useQueryClient();

  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const { data: balance } = useGetCreditsBalance();
  const { data: jobs } = useListChatJobs();
  const chatMutation = useCreateChatCompletion();

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null;

  // -------------------------------------------------------------------------
  // Socket lifecycle
  // -------------------------------------------------------------------------

  const handleBalanceUpdate = useCallback(
    ({ credits }: { credits: number }) => {
      queryClient.setQueryData(getGetCreditsBalanceQueryKey(), {
        credits,
        usdValue: credits * 0.01,
      });
    },
    [queryClient],
  );

  const handleJobToken = useCallback(
    ({ jobId, delta }: { jobId: string; delta: string; index: number }) => {
      if (jobId !== streamContextRef.current?.jobId) return;
      streamContextRef.current.fullText += delta;
      setStreamingText((prev) => prev + delta);
    },
    [],
  );

  const handleJobDone = useCallback(
    ({
      jobId,
      promptTokens,
      completionTokens,
      creditsCharged,
      workerAlias,
    }: {
      jobId: string;
      promptTokens: number;
      completionTokens: number;
      creditsCharged: number;
      workerAlias: string;
      tps: number;
    }) => {
      if (jobId !== streamContextRef.current?.jobId) return;
      const ctx = streamContextRef.current;

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: ctx.fullText,
        workerId: workerAlias,
        tokensUsed: promptTokens + completionTokens,
        creditsSpent: creditsCharged,
      };

      const finalConvs = ctx.convList.map((c) =>
        c.id === ctx.convId
          ? {
              ...c,
              messages: [...ctx.msgs, assistantMsg],
              updatedAt: Date.now(),
            }
          : c,
      );
      setConversations(finalConvs);
      saveConversations(storageKey, finalConvs);

      setIsStreaming(false);
      setStreamingText("");
      setActiveJobId(null);
      streamContextRef.current = null;

      queryClient.invalidateQueries({ queryKey: getListChatJobsQueryKey() });
    },
    [queryClient, storageKey],
  );

  const handleJobFailed = useCallback(
    ({
      jobId,
      reason,
    }: {
      jobId: string;
      reason: string;
      refunded: boolean;
    }) => {
      if (jobId !== streamContextRef.current?.jobId) return;
      const ctx = streamContextRef.current;

      const errorText =
        reason === "insufficient_credits"
          ? "You don't have enough credits to complete this request. Top up your balance to continue."
          : reason === "no_workers"
            ? "No workers are available right now. Please try again in a moment."
            : reason === "timeout"
              ? "The request timed out. Please try again."
              : reason === "worker_dropped"
                ? "AI providers are busy right now. Please try again in a few seconds."
                : "Something went wrong processing your request. Please try again.";

      const errorMsg: ChatMessage = { role: "assistant", content: errorText };
      const finalConvs = ctx.convList.map((c) =>
        c.id === ctx.convId
          ? { ...c, messages: [...ctx.msgs, errorMsg], updatedAt: Date.now() }
          : c,
      );
      setConversations(finalConvs);
      saveConversations(storageKey, finalConvs);

      setIsStreaming(false);
      setStreamingText("");
      setActiveJobId(null);
      streamContextRef.current = null;

      // Refresh balance so refunded credits are shown immediately
      queryClient.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() });
    },
    [queryClient, storageKey],
  );

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;
    if (!socket) return; // no auth token, socket-based streaming unavailable

    socket.on("balance:update", handleBalanceUpdate);
    socket.on("job:token", handleJobToken);
    socket.on("job:done", handleJobDone);
    socket.on("job:failed", handleJobFailed);

    return () => {
      socket.off("balance:update", handleBalanceUpdate);
      socket.off("job:token", handleJobToken);
      socket.off("job:done", handleJobDone);
      socket.off("job:failed", handleJobFailed);
    };
  }, [handleBalanceUpdate, handleJobToken, handleJobDone, handleJobFailed]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages, streamingText]);

  // -------------------------------------------------------------------------
  // Conversation management
  // -------------------------------------------------------------------------

  function newConversation() {
    const id = crypto.randomUUID();
    const conv: Conversation = {
      id,
      title: "New conversation",
      messages: [],
      model,
      updatedAt: Date.now(),
    };
    const updated = [conv, ...conversations];
    setConversations(updated);
    saveConversations(storageKey, updated);
    setActiveId(id);
  }

  function deleteConversation(id: string) {
    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    saveConversations(storageKey, updated);
    if (activeId === id) setActiveId(updated[0]?.id ?? null);
  }

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------

  async function sendMessage() {
    if (!input.trim() || isStreaming) return;

    let convId = activeId;
    let convList = conversations;

    if (!convId) {
      const id = crypto.randomUUID();
      const conv: Conversation = {
        id,
        title: input.slice(0, 40) + (input.length > 40 ? "..." : ""),
        messages: [],
        model,
        updatedAt: Date.now(),
      };
      convList = [conv, ...conversations];
      setConversations(convList);
      saveConversations(storageKey, convList);
      setActiveId(id);
      convId = id;
    }

    const textContent = codeMode
      ? `\`\`\`\n${input.trim()}\n\`\`\``
      : input.trim();
    const userMsg: ChatMessage = {
      role: "user",
      content: textContent,
      attachedImageUrl: attachedImage?.url,
    };
    const conv = convList.find((c) => c.id === convId)!;
    const msgs = [...conv.messages, userMsg];
    const updatedConvs = convList.map((c) =>
      c.id === convId
        ? {
            ...c,
            messages: msgs,
            title: msgs[0]?.content.slice(0, 40) ?? c.title,
            updatedAt: Date.now(),
          }
        : c,
    );
    setConversations(updatedConvs);
    saveConversations(storageKey, updatedConvs);
    setInput("");
    setAttachedImage(null);
    setCodeMode(false);

    const jobId = crypto.randomUUID();
    setIsStreaming(true);
    setStreamingText("");
    setActiveJobId(jobId);

    const socket = socketRef.current ?? connectSocket();

    if (socket) {
      // Store context so token/done/failed handlers can close over it
      streamContextRef.current = {
        convId,
        msgs,
        convList: updatedConvs,
        model,
        jobId,
        fullText: "",
      };

      socket.emit("job:create", {
        jobId,
        tier: model === "bee-glide" ? "glide" : "hover",
        model,
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        maxTokens: 4096,
      });
    } else {
      // No session token, fall back to REST + simulated typewriter
      try {
        const result = await chatMutation.mutateAsync({
          data: {
            model,
            messages: msgs.map((m) => ({ role: m.role, content: m.content })),
          },
        });

        const fullText = result.content;
        let i = 0;
        const ticker = setInterval(() => {
          i += Math.floor(Math.random() * 4) + 2;
          if (i >= fullText.length) {
            clearInterval(ticker);
            setStreamingText("");
            setIsStreaming(false);
            setActiveJobId(null);

            const assistantMsg: ChatMessage = {
              role: "assistant",
              content: fullText,
              workerId: result.workerId,
              tokensUsed: result.tokensUsed,
              creditsSpent: result.creditsDeducted,
            };
            const finalConvs = updatedConvs.map((c) =>
              c.id === convId
                ? { ...c, messages: [...msgs, assistantMsg], updatedAt: Date.now() }
                : c,
            );
            setConversations(finalConvs);
            saveConversations(storageKey, finalConvs);
            queryClient.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListChatJobsQueryKey() });
          } else {
            setStreamingText(fullText.slice(0, i));
          }
        }, 16);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        const errorText = msg.includes("402") || msg.includes("credits")
          ? "You don't have enough credits to complete this request. Top up your balance to continue."
          : "Something went wrong processing your request. Please try again.";
        const errorMsg: ChatMessage = { role: "assistant", content: errorText };
        const failed = updatedConvs.map((c) =>
          c.id === convId
            ? { ...c, messages: [...msgs, errorMsg], updatedAt: Date.now() }
            : c,
        );
        setConversations(failed);
        saveConversations(storageKey, failed);
        setIsStreaming(false);
        setStreamingText("");
        setActiveJobId(null);
      }
    }
  }

  function stopStreaming() {
    if (!activeJobId || !streamContextRef.current) return;
    const socket = socketRef.current ?? connectSocket();
    socket?.emit("job:cancel", { jobId: activeJobId });
    setIsStreaming(false);
    setStreamingText("");
    setActiveJobId(null);
    streamContextRef.current = null;
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleLogout() {
    clearSessionToken();
    disconnectSocket();
    window.dispatchEvent(new Event("storage"));
    navigate("/");
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
    <div className="flex h-screen bg-background overflow-hidden" data-testid="chat-page">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-40 md:z-auto
          flex-shrink-0 border-r border-border bg-card flex flex-col
          w-[240px] transition-all duration-200
          ${sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0 md:!w-0 md:overflow-hidden"
          }
        `}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full px-3 py-4 min-w-[240px]">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2.5 px-2 mb-5 hover:opacity-70 transition-opacity cursor-pointer">
              <BeeLogo className="h-5 w-5 flex-shrink-0" />
              <span className="font-semibold text-sm tracking-tight">Gigabee</span>
            </div>
          </Link>

          {/* New chat */}
          <button
            onClick={newConversation}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors mb-1"
            data-testid="btn-new-chat"
          >
            <Plus className="h-4 w-4 flex-shrink-0" />
            New conversation
          </button>

          {/* Conversation history */}
          <div className="flex-1 overflow-hidden mt-4">
            {conversations.length > 0 && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-3 mb-2">
                Recent
              </p>
            )}
            <ScrollArea className="h-full">
              {conversations.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-2">No conversations yet</p>
              ) : (
                <div className="space-y-0.5">
                  {conversations.map((c) => (
                    <div
                      key={c.id}
                      className={`group flex items-center gap-1 rounded-lg px-3 py-2 cursor-pointer text-sm transition-colors ${
                        activeId === c.id
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      }`}
                      onClick={() => setActiveId(c.id)}
                      data-testid={`conversation-${c.id}`}
                    >
                      <span className="flex-1 truncate text-xs">{c.title}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-destructive transition-opacity flex-shrink-0"
                        data-testid={`btn-delete-conv-${c.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-border/60 space-y-0.5">
            {/* Credits */}
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
              <Coins className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-xs text-muted-foreground flex-1">Credits</span>
              {balance ? (
                <span className="font-mono text-xs font-semibold text-foreground" data-testid="credits-balance">
                  {balance.credits}
                </span>
              ) : (
                <Skeleton className="h-3 w-8" />
              )}
              <button
                onClick={() => setShowBuyCredits(true)}
                className="ml-1 h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Buy credits"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Nav links */}
            <Link href="/earn">
              <button className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                <TrendingUp className="h-4 w-4 flex-shrink-0" />
                Earn Honey
              </button>
            </Link>
            <Link href="/docs">
              <button className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                <BookOpen className="h-4 w-4 flex-shrink-0" />
                Docs
              </button>
            </Link>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors mt-1"
              data-testid="btn-logout"
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              Log out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="h-12 border-b border-border/60 flex items-center px-3 gap-2 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
            data-testid="btn-toggle-sidebar"
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <span className="text-sm text-muted-foreground flex-1 truncate">
            {activeConversation?.title ?? "New conversation"}
          </span>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="px-4 py-8">
            {!activeConversation || activeConversation.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[55vh] text-center">
                <BeeLogo className="h-9 w-9 mb-5 opacity-20" />
                <h2 className="text-xl font-semibold text-foreground mb-1.5">How can Bee help you?</h2>
                <p className="text-sm text-muted-foreground/70 max-w-sm mb-9 leading-relaxed">
                  Runs on contributor GPUs worldwide. Prompts are never stored.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-[480px] w-full text-left">
                  {[
                    { label: "Explain distributed AI inference", sub: "How decentralized GPU networks work" },
                    { label: "Write code for me", sub: "Any language, I'll explain every line" },
                    { label: "Help me think through a problem", sub: "Analysis, brainstorming, or research" },
                    { label: "Debug an error", sub: "Paste your code or stack trace" },
                  ].map(({ label, sub }) => (
                    <button
                      key={label}
                      onClick={() => { setInput(label); textareaRef.current?.focus(); }}
                      className="p-3.5 rounded-xl border border-border hover:border-primary/25 bg-card hover:bg-secondary/30 text-left transition-all group"
                      data-testid={`prompt-suggestion-${label.slice(0, 20).replace(/\s+/g, "-")}`}
                    >
                      <p className="text-xs font-medium text-foreground mb-0.5">{label}</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{sub}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-6">
                {activeConversation.messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start items-start gap-3"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex-shrink-0 mt-0.5 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <BeeLogo className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`${
                        msg.role === "user"
                          ? "bg-secondary rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-foreground max-w-[80%]"
                          : "text-sm text-foreground leading-relaxed max-w-[85%]"
                      }`}
                      data-testid={`message-${msg.role}-${i}`}
                    >
                      {msg.attachedImageUrl && (
                        <img
                          src={msg.attachedImageUrl}
                          alt="Attached"
                          className="max-w-full max-h-48 rounded-xl mb-2 object-contain"
                        />
                      )}
                      {msg.role === "assistant" ? (
                        <div className="min-w-0">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                      )}
                      {msg.role === "assistant" && msg.tokensUsed && (
                        <p className="text-[11px] text-muted-foreground/60 mt-2 font-mono">
                          {msg.tokensUsed}t · {msg.creditsSpent} credits · {msg.workerId?.slice(0, 8)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {isStreaming && (
                  <div className="flex justify-start items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <BeeLogo className="h-4 w-4" />
                    </div>
                    <div className="text-sm text-foreground leading-relaxed max-w-[85%]">
                      {streamingText ? (
                        <span className="whitespace-pre-wrap">
                          {streamingText}
                          <span className="inline-block w-[2px] h-4 bg-primary ml-0.5 animate-pulse rounded-full" />
                        </span>
                      ) : (
                        <span className="flex gap-1 items-center h-5">
                          {[0, 150, 300].map((d) => (
                            <span
                              key={d}
                              className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
                              style={{ animationDelay: `${d}ms` }}
                            />
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* ── Composer ────────────────────────────────────────────────── */}
        <div className="px-4 pb-4 pt-2 border-t border-border/60 flex-shrink-0 bg-background">

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setAttachedImage({ file, url: URL.createObjectURL(file) });
              e.target.value = "";
            }}
          />

          <div className="max-w-2xl mx-auto">
            <div className={`rounded-2xl border bg-card shadow-sm transition-colors focus-within:border-primary/40 ${codeMode ? "border-primary/30" : "border-border"}`}>

              {/* Image preview strip */}
              {attachedImage && (
                <div className="px-3 pt-3 flex items-start gap-3">
                  <div className="relative group w-[72px] h-[72px] rounded-xl overflow-hidden border border-border flex-shrink-0">
                    <img src={attachedImage.url} alt="Attached" className="w-full h-full object-cover" />
                    <button
                      onClick={() => { URL.revokeObjectURL(attachedImage.url); setAttachedImage(null); }}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      aria-label="Remove image"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>
                  <div className="pt-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{attachedImage.file.name}</p>
                    <p className="text-[11px] text-muted-foreground">{(attachedImage.file.size / 1024).toFixed(0)} KB</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">Vision coming soon · image will not be sent to the model yet</p>
                  </div>
                </div>
              )}

              {/* Code mode indicator */}
              {codeMode && (
                <div className="px-4 pt-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-medium">
                    <Code2 className="h-3 w-3" />
                    Code mode · wraps in code fence on send
                  </span>
                </div>
              )}

              {/* Textarea */}
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={codeMode ? "Paste or type your code..." : "Message Bee..."}
                className={`min-h-[56px] max-h-40 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm px-4 pt-4 pb-2 ${codeMode ? "font-mono" : ""}`}
                disabled={isStreaming}
                data-testid="input-message"
              />

              {/* Toolbar row */}
              <div className="flex items-center justify-between px-3 pb-3 gap-2">

                {/* Left: capability buttons */}
                <div className="flex items-center gap-0.5">

                  {/* Attach image */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isStreaming}
                    title="Attach image"
                    className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
                      attachedImage
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </button>

                  {/* Code mode toggle */}
                  <button
                    onClick={() => setCodeMode(!codeMode)}
                    disabled={isStreaming}
                    title="Code mode"
                    className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
                      codeMode
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <Code2 className="h-3.5 w-3.5" />
                  </button>

                  {/* Separator */}
                  <div className="w-px h-4 bg-border mx-1" />

                  {/* Web search, coming soon */}
                  <button
                    disabled
                    title="Web search (coming soon)"
                    className="h-7 px-2 rounded-lg flex items-center gap-1 text-muted-foreground/40 cursor-not-allowed"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium">Search</span>
                  </button>

                  {/* Generate image */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        disabled={isStreaming}
                        className="h-7 px-2 rounded-lg flex items-center gap-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-medium">Image</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="start" className="w-56 p-3">
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                          <span className="text-sm font-semibold text-foreground">Bee DAL</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          AI image generation powered by the Gigabee network.
                        </p>
                        <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-2.5 py-1.5">
                          <span className="text-xs text-muted-foreground">Cost per image</span>
                          <span className="text-xs font-semibold text-foreground">20 credits</span>
                        </div>
                        <button
                          onClick={() => {
                            if (imgGenConsent) {
                              setInput((prev) => prev || "Generate an image of: ");
                              setTimeout(() => textareaRef.current?.focus(), 0);
                            } else {
                              setImageGenOpen(true);
                            }
                          }}
                          className="w-full h-7 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                        >
                          Generate Image →
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Right: model picker + send */}
                <div className="flex items-center gap-2 flex-shrink-0">

                  {/* Model toggle */}
                  <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5">
                    {(Object.entries(MODEL_INFO) as [Model, typeof MODEL_INFO[Model]][]).map(([key, info]) => (
                      <button
                        key={key}
                        onClick={() => setModel(key)}
                        className={`text-xs px-2.5 py-1 rounded-md transition-colors font-medium whitespace-nowrap ${
                          model === key
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        data-testid={`model-option-${key}`}
                      >
                        {info.label}
                        <span className="ml-1 text-[10px] opacity-60 font-mono">{info.cost}cr</span>
                      </button>
                    ))}
                  </div>

                  {/* Send / Stop */}
                  {isStreaming ? (
                    <button
                      onClick={stopStreaming}
                      className="h-8 w-8 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
                      data-testid="btn-stop"
                    >
                      <Square className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      id="chat-send-btn"
                      onClick={sendMessage}
                      disabled={!input.trim() && !attachedImage}
                      className="h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 transition-colors flex items-center justify-center text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      data-testid="btn-send"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground/50 text-center mt-2">
              Prompts are never stored · Runs on contributor GPUs
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* Generate Image Dialog */}
    <Dialog
      open={imageGenOpen}
      onOpenChange={(open) => {
        setImageGenOpen(open);
        if (!open) { setAgeConfirmed(false); setTermsAccepted(false); }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Generate Image
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {/* Pricing */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <Coins className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm text-muted-foreground">
              20 credits per image <span className="text-foreground font-medium">($0.20)</span> · deducted from your balance
            </span>
          </div>

          {/* Prompt field */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Image prompt</label>
            <textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="A honeybee on a golden honeycomb, digital art, dark background..."
              rows={3}
              className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>

          {/* Age + content compliance */}
          <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Content compliance</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              By using image generation you confirm you are of legal age and that your use complies with all applicable laws.
              Gigabee never stores generated images. Do not generate illegal content.
            </p>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-0.5 accent-primary shrink-0"
              />
              <span className="text-xs text-foreground leading-relaxed">
                I am <strong>18 years of age or older</strong> and my use complies with local laws.
              </span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 accent-primary shrink-0"
              />
              <span className="text-xs text-foreground leading-relaxed">
                I accept the <a href="/docs#content-policy" className="text-primary underline underline-offset-2">Gigabee Content Policy</a>.
              </span>
            </label>
          </div>

          <button
            disabled={!ageConfirmed || !termsAccepted || !imagePrompt.trim()}
            onClick={() => {
              localStorage.setItem("gigabee-imggen-consent-v1", "1");
              setImgGenConsent(true);
              setImageGenOpen(false);
              setAgeConfirmed(false);
              setTermsAccepted(false);
              const prompt = imagePrompt.trim();
              setImagePrompt("");
              setInput(`Generate an image of: ${prompt}`);
              setTimeout(() => {
                textareaRef.current?.focus();
                // auto-send
                document.getElementById("chat-send-btn")?.click();
              }, 50);
            }}
            className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-opacity disabled:opacity-35 disabled:cursor-not-allowed"
          >
            Generate · 20 credits
          </button>
        </div>
      </DialogContent>
    </Dialog>
    <BuyCreditsModal open={showBuyCredits} onClose={() => setShowBuyCredits(false)} />
    </>
  );
}
