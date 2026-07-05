export const OFFER_ACK_MS      = 3_000;
export const FIRST_TOKEN_MS    = 15_000;
export const TOKEN_GAP_MS      = 20_000;
export const QUEUE_MAX_MS      = 60_000;
export const HEARTBEAT_MS      = 10_000;
export const WORKER_DEAD_AFTER = 25_000;

export const MODEL_CREDITS: Record<string, number> = {
  "bee-nano":  5,
  "bee-hover": 10,
  "bee-glide": 15,
  // backward compat: old model IDs stored in existing DB records
  "bea-hover": 10,
  "bea-glide": 15,
};

/** Map logical model → DB tier (bee-nano runs on the same hover workers) */
export const MODEL_TIER: Record<string, "hover" | "glide"> = {
  "bee-nano":  "hover",
  "bee-hover": "hover",
  "bee-glide": "glide",
  "bea-hover": "hover",
  "bea-glide": "glide",
};

export const MIRROR_PROB = 0.01;
export const CANARY_PROB = 0.02;

/** Known Q&A pairs used to probe worker quality without the user knowing.
 *  The worker's response is checked for at least one keyword (case-insensitive). */
export const CANARY_PAIRS: Array<{ question: string; keywords: string[]; model: string }> = [
  { question: "What is 17 + 25?",                     keywords: ["42"],                      model: "bee-nano" },
  { question: "What is the capital of France?",        keywords: ["paris"],                   model: "bee-nano" },
  { question: "What color is the sky on a clear day?", keywords: ["blue", "bleu"],            model: "bee-nano" },
  { question: "What is 3 multiplied by 7?",            keywords: ["21"],                      model: "bee-nano" },
  { question: "Name one primary color.",               keywords: ["red", "blue", "yellow"],   model: "bee-nano" },
];

/** Maps MLC model IDs → a short prefix of their expected SHA-256 content hash.
 *  Workers that provide a matching hash get a reputation bonus on registration. */
export const KNOWN_MODEL_HASHES: Record<string, string> = {
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC": "qwen25-05b-q4f16-v1",
  "Qwen2.5-1.5B-Instruct-q4f16_1-MLC": "qwen25-15b-q4f16-v1",
  "Llama-3.2-1B-Instruct-q4f16_1-MLC": "llama32-1b-q4f16-v1",
};

/** Minimum minutes a worker must be idle before reputation drifts back toward neutral. */
export const REPUTATION_DECAY_AFTER_IDLE_MS = 60 * 60 * 1000; // 1 hour
