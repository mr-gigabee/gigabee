/**
 * OpenAI-compatible REST API  —  /api/v1
 *
 * Exposes the Gigabee inference layer via the same interface as OpenAI's
 * Chat Completions API so any OpenAI SDK client (Hermes, LangChain,
 * Vercel AI SDK, plain curl) can use it without modification.
 *
 *   base_url : https://gigabee.io/api/v1
 *   auth     : Authorization: Bearer <session_token or giga_...>
 *   models   : bee-nano (5 cr)  bee-hover (10 cr)  bee-glide (15 cr)
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { chargeAndCreateJob, recordJobCompletion } from "../lib/billing";
import { MODEL_CREDITS, MODEL_TIER } from "../lib/constants";
import { openai } from "@workspace/integrations-openai-ai-server";
import { openrouter } from "@workspace/integrations-openrouter-ai";
import { chatRateLimit } from "../lib/security";
import { BEE_SYSTEM_PROMPT, FREE_MODELS, MAX_TOKENS } from "../lib/ai";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type Role = "system" | "user" | "assistant";

interface ChatMessage {
  role: Role;
  content: string;
}

interface ChatCompletionBody {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

/** Map friendly aliases to Gigabee tier IDs */
function resolveModel(raw: string): "bee-nano" | "bee-hover" | "bee-glide" {
  const lower = raw.toLowerCase();
  if (lower === "bee-glide" || lower.includes("70b") || lower.includes("glide")) {
    return "bee-glide";
  }
  if (lower === "bee-nano" || lower.includes("nano")) {
    return "bee-nano";
  }
  return "bee-hover";
}

function isValidBody(body: unknown): body is ChatCompletionBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (typeof b.model !== "string") return false;
  if (!Array.isArray(b.messages) || b.messages.length === 0) return false;
  for (const m of b.messages as unknown[]) {
    if (!m || typeof m !== "object") return false;
    const msg = m as Record<string, unknown>;
    if (!["system", "user", "assistant"].includes(msg.role as string)) return false;
    if (typeof msg.content !== "string") return false;
  }
  return true;
}

/** Run inference: OpenAI primary → OpenRouter fallback. Returns full content string. */
async function runInference(
  userMessages: ChatMessage[],
  maxTokens: number,
  onChunk?: (delta: string) => void,
): Promise<string> {
  let content = "";

  // ── Primary: OpenAI gpt-4.1 ─────────────────────────────────────────────
  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_tokens: maxTokens,
      stream: true,
      messages: [
        { role: "system", content: BEE_SYSTEM_PROMPT },
        ...userMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        content += delta;
        onChunk?.(delta);
      }
    }
    return content;
  } catch (err) {
    logger.warn({ err }, "v1: OpenAI primary failed — trying OpenRouter fallback");
  }

  // ── Fallback: OpenRouter free models ────────────────────────────────────
  for (const candidate of FREE_MODELS) {
    try {
      const stream = await openrouter.chat.completions.create({
        model: candidate,
        max_tokens: maxTokens,
        stream: true,
        messages: [
          { role: "system", content: BEE_SYSTEM_PROMPT },
          ...userMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ],
      });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          content += delta;
          onChunk?.(delta);
        }
      }
      return content;
    } catch (err) {
      logger.warn({ err, candidate }, "v1: OpenRouter model failed — trying next");
      continue;
    }
  }

  throw new Error("All inference backends failed");
}

// ── GET /api/v1/models ───────────────────────────────────────────────────────

router.get("/v1/models", (_req: Request, res: Response) => {
  res.json({
    object: "list",
    data: [
      {
        id: "bee-nano",
        object: "model",
        created: 1700000000,
        owned_by: "gigabee",
        description: "Lightweight fast model — 5 credits per request",
      },
      {
        id: "bee-hover",
        object: "model",
        created: 1700000000,
        owned_by: "gigabee",
        description: "Balanced model — 10 credits per request",
      },
      {
        id: "bee-glide",
        object: "model",
        created: 1700000000,
        owned_by: "gigabee",
        description: "High-quality model — 15 credits per request",
      },
    ],
  });
});

// ── POST /api/v1/chat/completions ────────────────────────────────────────────

router.post(
  "/v1/chat/completions",
  chatRateLimit,
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = (req as AuthedRequest).user;

    if (!isValidBody(req.body)) {
      res.status(400).json({
        error: {
          message: "Request must include a string 'model' and a non-empty 'messages' array with role+content.",
          type: "invalid_request_error",
          code: "invalid_request",
        },
      });
      return;
    }

    const body = req.body as ChatCompletionBody;
    const model = resolveModel(body.model);
    const creditsRequired = MODEL_CREDITS[model] ?? 10;
    const tier = MODEL_TIER[model] ?? "hover";
    const streamMode = body.stream === true;
    const maxTokens = body.max_tokens ?? MAX_TOKENS;

    const charge = await chargeAndCreateJob({
      userId: user.id,
      tier,
      model,
      creditsRequired,
    });

    if (!charge.ok) {
      res.status(402).json({
        error: {
          message: "Insufficient credits. Please top up at gigabee.io/earn.",
          type: "insufficient_quota",
          code: "insufficient_credits",
        },
      });
      return;
    }

    const completionId = `chatcmpl-${charge.jobId}`;
    const startedAt = Date.now();
    const createdUnix = Math.floor(startedAt / 1000);
    const promptTokens = body.messages.reduce(
      (s, m) => s + Math.ceil(m.content.length / 4),
      0,
    );
    const userMessages = body.messages.filter((m) => m.role !== "system");

    let firstTokenAt: number | undefined;

    if (streamMode) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      let content = "";
      try {
        content = await runInference(userMessages, maxTokens, (delta) => {
          if (!firstTokenAt) firstTokenAt = Date.now();
          const payload = {
            id: completionId,
            object: "chat.completion.chunk",
            created: createdUnix,
            model,
            choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
          };
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        });
      } catch {
        res.write(`data: ${JSON.stringify({ error: { message: "Inference failed. Please try again.", type: "server_error", code: "inference_failed" } })}\n\n`);
        res.end();
        return;
      }

      const stopPayload = {
        id: completionId,
        object: "chat.completion.chunk",
        created: createdUnix,
        model,
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      };
      res.write(`data: ${JSON.stringify(stopPayload)}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();

      const completionTokens = Math.ceil(content.length / 4);
      const durationMs = Date.now() - startedAt;
      const ttfbMs = firstTokenAt ? firstTokenAt - startedAt : durationMs;
      await recordJobCompletion({ jobId: charge.jobId, creditsCharged: creditsRequired, promptTokens, completionTokens, ttfbMs, durationMs });

    } else {
      let content = "";
      try {
        content = await runInference(userMessages, maxTokens, (delta) => {
          if (!firstTokenAt) firstTokenAt = Date.now();
        });
      } catch {
        res.status(502).json({
          error: {
            message: "Inference failed. Please try again in a moment.",
            type: "server_error",
            code: "inference_failed",
          },
        });
        return;
      }

      const completionTokens = Math.ceil(content.length / 4);
      const durationMs = Date.now() - startedAt;
      const ttfbMs = firstTokenAt ? firstTokenAt - startedAt : durationMs;

      await recordJobCompletion({ jobId: charge.jobId, creditsCharged: creditsRequired, promptTokens, completionTokens, ttfbMs, durationMs });

      res.json({
        id: completionId,
        object: "chat.completion",
        created: createdUnix,
        model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      });
    }
  },
);

export default router;
