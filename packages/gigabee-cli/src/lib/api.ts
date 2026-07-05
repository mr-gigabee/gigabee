import { GigabeeClient } from "gigabee-sdk";
import { loadConfig } from "./config";

export function makeClient(): GigabeeClient {
  const cfg = loadConfig();
  const base = new GigabeeClient({ baseUrl: cfg.apiUrl });
  return cfg.token ? base.withToken(cfg.token) : base;
}
