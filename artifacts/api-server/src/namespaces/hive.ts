import type { Server, Socket } from "socket.io";
import { db, sessionsTable, workersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { orchestrator } from "../lib/orchestrator";

interface HiveSocketData {
  workerId: string;
  userId: string | null;
  dbWorkerId: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HiveSocket = Socket<any, any, any, HiveSocketData>;

async function resolveToken(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || !token) return null;
  const [session] = await db
    .select({ userId: sessionsTable.userId })
    .from(sessionsTable)
    .where(eq(sessionsTable.token, token));
  return session?.userId ?? null;
}

export function setupHiveNamespace(io: Server) {
  const ns = io.of("/hive");

  ns.on("connection", async (socket: HiveSocket) => {
    // Resolve Bearer token → userId (best-effort; workers can still join without one)
    const userId = await resolveToken(socket.handshake.auth?.token).catch(() => null);
    socket.data.userId = userId;
    socket.data.dbWorkerId = null;

    logger.info({ socketId: socket.id, userId: userId ?? "anonymous" }, "Hive socket connected");

    // -------------------------------------------------------------------------
    // worker:register
    // -------------------------------------------------------------------------
    socket.on(
      "worker:register",
      async (payload: {
        type: "browser" | "native";
        models: string[];
        benchTps: number;
        version: string;
        /** SHA-256-derived hash of the model weights file for integrity verification (#7). */
        modelHash?: string;
      }) => {
        if (!payload?.type || !Array.isArray(payload?.models)) {
          socket.emit("error:auth", { message: "Invalid registration payload" });
          return;
        }

        const workerId = orchestrator.registerWorker(socket.id, {
          type: payload.type,
          models: payload.models,
          benchTps: payload.benchTps ?? 0,
          version: payload.version ?? "unknown",
          modelHash: payload.modelHash,
        });

        socket.data.workerId = workerId;
        socket.emit("worker:registered", { workerId });

        // Persist to DB when we have an authenticated userId
        if (socket.data.userId) {
          const uid = socket.data.userId;
          const measuredTps = String(payload.benchTps ?? 0);
          const now = new Date();

          try {
            const [existing] = await db
              .select({ id: workersTable.id })
              .from(workersTable)
              .where(eq(workersTable.userId, uid));

            if (existing) {
              await db
                .update(workersTable)
                .set({ type: payload.type, models: payload.models, measuredTps, lastSeenAt: now })
                .where(eq(workersTable.id, existing.id));
              socket.data.dbWorkerId = existing.id;
            } else {
              const [inserted] = await db
                .insert(workersTable)
                .values({ userId: uid, type: payload.type, models: payload.models, measuredTps, lastSeenAt: now })
                .returning({ id: workersTable.id });
              socket.data.dbWorkerId = inserted?.id ?? null;
            }

            // Link in-memory worker → DB UUID so earnings are recorded correctly
            if (socket.data.dbWorkerId) {
              orchestrator.setWorkerDbId(socket.id, socket.data.dbWorkerId);
            }

            logger.info(
              { workerId, dbWorkerId: socket.data.dbWorkerId, userId: uid },
              "Worker persisted to DB",
            );
          } catch (err) {
            logger.error({ err, userId: uid }, "Failed to persist worker to DB");
          }
        }
      },
    );

    // -------------------------------------------------------------------------
    // worker:heartbeat  { load, vramFreeMb? }
    // -------------------------------------------------------------------------
    socket.on(
      "worker:heartbeat",
      async (payload: { load: number; vramFreeMb?: number }) => {
        orchestrator.workerHeartbeat(socket.id, payload?.load ?? 0, payload?.vramFreeMb);

        // Touch lastSeenAt in DB so the monitor panel reflects "online" correctly
        if (socket.data.dbWorkerId) {
          await db
            .update(workersTable)
            .set({ lastSeenAt: new Date() })
            .where(eq(workersTable.id, socket.data.dbWorkerId))
            .catch((err) => logger.warn({ err }, "Heartbeat DB update failed"));
        }
      },
    );

    // -------------------------------------------------------------------------
    // job:accept  { jobId }
    // -------------------------------------------------------------------------
    socket.on("job:accept", (payload: { jobId: string }) => {
      if (typeof payload?.jobId !== "string") return;
      orchestrator.workerAcceptedJob(socket.id, payload.jobId);
    });

    // -------------------------------------------------------------------------
    // job:token  { jobId, delta, index }
    // -------------------------------------------------------------------------
    socket.on(
      "job:token",
      (payload: { jobId: string; delta: string; index: number }) => {
        if (
          typeof payload?.jobId !== "string" ||
          typeof payload?.delta !== "string"
        )
          return;
        orchestrator.workerTokenReceived(
          socket.id,
          payload.jobId,
          payload.delta,
          payload.index ?? 0,
        );
      },
    );

    // -------------------------------------------------------------------------
    // job:complete  { jobId, promptTokens, completionTokens }
    // -------------------------------------------------------------------------
    socket.on(
      "job:complete",
      async (payload: {
        jobId: string;
        promptTokens: number;
        completionTokens: number;
      }) => {
        if (typeof payload?.jobId !== "string") return;
        await orchestrator
          .workerCompleteJob(
            socket.id,
            payload.jobId,
            payload.promptTokens ?? 0,
            payload.completionTokens ?? 0,
          )
          .catch((err) =>
            logger.error({ err, jobId: payload.jobId }, "workerCompleteJob error"),
          );
      },
    );

    // -------------------------------------------------------------------------
    // job:error  { jobId, code }
    // -------------------------------------------------------------------------
    socket.on(
      "job:error",
      (payload: { jobId: string; code: "oom" | "model_error" | "aborted" }) => {
        if (typeof payload?.jobId !== "string") return;
        orchestrator.workerErrorJob(socket.id, payload.jobId, payload.code ?? "model_error");
      },
    );

    // -------------------------------------------------------------------------
    // disconnect
    // -------------------------------------------------------------------------
    socket.on("disconnect", () => {
      logger.info(
        { socketId: socket.id, workerId: socket.data.workerId, userId: socket.data.userId },
        "Hive socket disconnected",
      );
      orchestrator.workerDisconnected(socket.id);
    });
  });
}
