import { homedir } from "node:os";
import { join } from "node:path";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const GIGABEE_DIR = join(homedir(), ".gigabee");
const CREDS_FILE = join(GIGABEE_DIR, "credentials.json");

export interface Credentials {
  token: string;
  workerId?: string;
  accountId: string;
  createdAt: string;
}

export async function ensureDir(): Promise<void> {
  await mkdir(GIGABEE_DIR, { recursive: true, mode: 0o700 });
}

export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const raw = await readFile(CREDS_FILE, "utf8");
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  await ensureDir();
  await writeFile(CREDS_FILE, JSON.stringify(creds, null, 2), {
    mode: 0o600,
    encoding: "utf8",
  });
}

export async function clearCredentials(): Promise<void> {
  if (existsSync(CREDS_FILE)) {
    await rm(CREDS_FILE);
  }
}

export function gigabeeDir(): string {
  return GIGABEE_DIR;
}

export function logFilePath(): string {
  return join(GIGABEE_DIR, "worker.log");
}
