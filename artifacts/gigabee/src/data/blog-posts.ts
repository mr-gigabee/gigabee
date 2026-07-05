export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  publishedAt: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-gigabee-decentralized-ai-infrastructure-works",
    title: "How Gigabee's Decentralized AI Infrastructure Works: A Technical Deep Dive",
    excerpt:
      "A look inside the orchestrator, worker selection, token streaming, and the Solana payment rail that powers every Bee conversation.",
    category: "Infrastructure",
    readTime: "9 min read",
    publishedAt: "2026-06-03T09:14:00Z",
  },
  {
    slug: "how-to-set-up-gigabee-worker-earn-usdc",
    title: "How to Set Up a Gigabee GPU Worker and Earn USDC: Complete Step-by-Step Guide",
    excerpt:
      "Everything you need to go from zero to a running Gigabee worker, browser-based WebGPU mode or native Ollama setup, and start collecting Honey.",
    category: "How-to",
    readTime: "11 min read",
    publishedAt: "2026-06-11T14:37:00Z",
  },
  {
    slug: "gigabee-worker-earnings-guide-honey-rewards",
    title: "Gigabee Worker Earnings Guide: How Much Can You Make Running AI Inference Jobs?",
    excerpt:
      "A complete breakdown of the Honey formula, per-job payouts for Bee Hover and Bee Glide, GPU earnings ranges, referral bonuses, and withdrawal to USDC.",
    category: "Earning",
    readTime: "8 min read",
    publishedAt: "2026-06-20T11:22:00Z",
  },
  {
    slug: "is-gigabee-private-zero-prompt-storage-wallet-auth",
    title: "Is Gigabee Private? How Zero Prompt Storage and Wallet Auth Protect Your Data",
    excerpt:
      "No email, no password, no conversation logs on the server. Here is exactly what Gigabee stores, what it never stores, and why the architecture makes surveillance structurally impossible.",
    category: "Privacy",
    readTime: "7 min read",
    publishedAt: "2026-06-28T08:55:00Z",
  },
  {
    slug: "gigabee-worker-v1-3-update-earnings-benchmark-monitor",
    title: "Worker Script v1.3: Earnings Fix, Benchmark Warm-Up, and Real-Time Monitor",
    excerpt:
      "Four critical fixes shipped: earnings now correctly recorded per job, benchmark no longer reads near-zero on cold start, live worker monitor panel on /earn, and an automatic scheduler that releases pending Honey after 24 hours.",
    category: "Updates",
    readTime: "6 min read",
    publishedAt: "2026-07-03T10:00:00Z",
  },
  {
    slug: "gigabee-hermes-agent-decentralized-gpu-backend",
    title: "Using Gigabee as a Hermes Agent Backend: Decentralized GPU Inference in One Config Change",
    excerpt:
      "Hermes Agent from NousResearch now runs on Gigabee's distributed GPU network. Generate a giga_ API key, set two lines in your config, and your autonomous agent gets inference powered by real contributor hardware instead of a single cloud provider.",
    category: "Updates",
    readTime: "7 min read",
    publishedAt: "2026-07-03T14:00:00Z",
  },
];

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
