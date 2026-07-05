import type {
  NetworkStats,
  CreditsBalance,
  ChatOptions,
  ChatResponse,
  ChatJob,
  CreditPackagesResponse,
  GigabeeClientOptions,
} from "./types.js";
import {
  GigabeeError,
  GigabeeAuthError,
  GigabeeInsufficientCreditsError,
  GigabeeNetworkError,
} from "./errors.js";

const DEFAULT_BASE_URL = "https://gigabee.app/api";

export class GigabeeClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;

  constructor(options: GigabeeClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env["GIGABEE_API_URL"] ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.token = options.token ?? process.env["GIGABEE_TOKEN"];
  }

  /**
   * Returns a new authenticated client with the given bearer token.
   * @example const client = new GigabeeClient().withToken("gbk_...");
   */
  withToken(token: string): GigabeeClient {
    return new GigabeeClient({ baseUrl: this.baseUrl, token });
  }

  /**
   * Fetch live network statistics. No authentication required.
   */
  async getStats(): Promise<NetworkStats> {
    return this.request<NetworkStats>("/stats");
  }

  /**
   * Get the authenticated user's credit balance.
   * Requires a token — call `.withToken()` first.
   */
  async getBalance(): Promise<CreditsBalance> {
    this.requireAuth();
    return this.request<CreditsBalance>("/credits/balance");
  }

  /**
   * List all available credit packages.
   */
  async getCreditPackages(): Promise<CreditPackagesResponse> {
    return this.request<CreditPackagesResponse>("/credits/packages");
  }

  /**
   * Send a message to Bee and get a response.
   * Requires a token — call `.withToken()` first.
   *
   * @example
   * const res = await client.chat({
   *   messages: [{ role: "user", content: "What is Gigabee?" }],
   *   model: "bee-hover",
   * });
   * console.log(res.content);
   */
  async chat(options: ChatOptions): Promise<ChatResponse> {
    this.requireAuth();
    return this.request<ChatResponse>("/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: options.messages,
        model: options.model ?? "bee-hover",
      }),
    });
  }

  /**
   * List the authenticated user's recent chat jobs.
   * Requires a token — call `.withToken()` first.
   */
  async listJobs(): Promise<ChatJob[]> {
    this.requireAuth();
    return this.request<ChatJob[]>("/chat/jobs");
  }

  private requireAuth(): void {
    if (!this.token) throw new GigabeeAuthError();
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    let res: Response;
    try {
      res = await fetch(url, { ...init, headers });
    } catch (err) {
      throw new GigabeeNetworkError(err instanceof Error ? err : new Error(String(err)));
    }

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {}

      if (res.status === 401) throw new GigabeeAuthError(message);
      if (res.status === 402) throw new GigabeeInsufficientCreditsError(message);
      throw new GigabeeError(message, res.status);
    }

    return res.json() as Promise<T>;
  }
}
