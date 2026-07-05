/**
 * REST API client for the Gigabee orchestrator.
 * Used for account linking, earnings queries, and status checks.
 */

import { loadCredentials } from "./credentials.js";

const DEFAULT_BASE = "https://gigabee.io/api";

function baseUrl(): string {
  return process.env["GIGABEE_API_URL"] ?? DEFAULT_BASE;
}

async function request<T>(
  path: string,
  opts: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token: explicitToken, ...fetchOpts } = opts;
  const creds = explicitToken ? null : await loadCredentials();
  const token = explicitToken ?? creds?.token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOpts.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl()}${path}`, { ...fetchOpts, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Account link ───────────────────────────────────────────────────────────

export interface LinkRequestResponse {
  code: string;
  expiresAt: string;
}

export async function requestLinkCode(): Promise<LinkRequestResponse> {
  return request<LinkRequestResponse>("/workers/link-request", {
    method: "POST",
  });
}

export interface LinkStatusResponse {
  status: "pending" | "claimed";
  token?: string;
  accountId?: string;
}

export async function pollLinkStatus(code: string): Promise<LinkStatusResponse> {
  return request<LinkStatusResponse>(`/workers/link-status?code=${encodeURIComponent(code)}`);
}

// ── Earnings ───────────────────────────────────────────────────────────────

export interface EarningsResponse {
  pendingUsd: number;
  availableUsd: number;
  lifetimeUsd: number;
  jobsCompleted: number;
}

export async function getEarnings(): Promise<EarningsResponse> {
  return request<EarningsResponse>("/workers/earnings");
}

// ── Status ─────────────────────────────────────────────────────────────────

export interface WorkerStatusResponse {
  online: boolean;
  reputation: number;
  uptimePct: number;
  jobsDone: number;
  jobsFailed: number;
}

export async function getWorkerStatus(): Promise<WorkerStatusResponse> {
  return request<WorkerStatusResponse>("/workers/status");
}
