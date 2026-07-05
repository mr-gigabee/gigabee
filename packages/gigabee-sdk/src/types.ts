export interface NetworkStats {
  workersOnline: number;
  jobsToday: number;
  honeyPaidOutUsd: number;
  tokensGenerated: number;
  activeModels: number;
  daily: Array<{ day: string; jobs: number; tokens: number }>;
  byModel: Array<{ model: string; jobs: number; tokens: number }>;
}

export interface CreditsBalance {
  credits: number;
  usdValue: number;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export type BeeModel = "bee-nano" | "bee-hover" | "bee-glide";

export interface ChatOptions {
  messages: ChatMessage[];
  model?: BeeModel;
}

export interface ChatResponse {
  jobId: string;
  content: string;
  promptTokens: number;
  completionTokens: number;
  creditsCharged: number;
  workerAlias: string | null;
  model: string;
  durationMs: number;
}

export interface ChatJob {
  id: string;
  model: string;
  status: string;
  promptTokens: number | null;
  completionTokens: number | null;
  creditsCharged: number | null;
  workerAlias: string | null;
  createdAt: string;
}

export interface CreditPackage {
  id: string;
  label: string;
  usdcAmount: number;
  credits: number;
  bonus: number;
  pricePerCredit: string;
}

export interface CreditPackagesResponse {
  packages: CreditPackage[];
  treasuryWallet: string;
}

export interface GigabeeClientOptions {
  baseUrl?: string;
  token?: string;
}
