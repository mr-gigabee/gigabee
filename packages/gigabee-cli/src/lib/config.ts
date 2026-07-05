import { homedir } from "os";
import { join } from "path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";

export interface Config {
  token?: string;
  apiUrl: string;
}

const CONFIG_DIR = join(homedir(), ".config", "gigabee");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export const DEFAULT_API_URL = process.env["GIGABEE_API_URL"] ?? "https://gigabee.app/api";

export function loadConfig(): Config {
  if (process.env["GIGABEE_TOKEN"] || process.env["GIGABEE_API_URL"]) {
    const file = existsSync(CONFIG_FILE)
      ? (JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as Partial<Config>)
      : {};
    return {
      apiUrl: process.env["GIGABEE_API_URL"] ?? file.apiUrl ?? DEFAULT_API_URL,
      token: process.env["GIGABEE_TOKEN"] ?? file.token,
    };
  }
  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Config>;
    return { apiUrl: parsed.apiUrl ?? DEFAULT_API_URL, token: parsed.token };
  } catch {
    return { apiUrl: DEFAULT_API_URL };
  }
}

export function saveConfig(patch: Partial<Config>): void {
  const current = loadConfig();
  const next = { ...current, ...patch };
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2));
}

export function configFilePath(): string {
  return CONFIG_FILE;
}
