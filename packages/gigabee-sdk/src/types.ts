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
  id: string;
  content: string;
  tokensUsed: number;
  creditsDeducted: number;
  workerId: string;
  model: string;
}

export interface ChatJob {
  id: string;
  model: string;
  tier: string;
  status: string;
  tokensUsed: number;
  creditsSpent: number;
  workerId: string | null;
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
