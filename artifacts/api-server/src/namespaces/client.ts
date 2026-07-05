import type { Server, Socket } from "socket.io";
import { db, sessionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { orchestrator, type ChatMessage } from "../lib/orchestrator";

interface ClientSocketData {
  user: { id: string; email: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClientSocket = Socket<any, any, any, ClientSocketData>;

async function verifyToken(
  token: unknown,
): Promise<{ id: string; email: string } | null> {
  if (typeof token !== "string" || !token) return null;

  const [session] = await db
    .select({ userId: sessionsTable.userId })
    .from(sessionsTable)
    .where(eq(sessionsTable.token, token));

  if (!session) return null;

  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, session.userId));

  return user ?? null;
}

export function setupClientNamespace(io: Server) {
  const ns = io.of("/client");

  // Auth middleware
  ns.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth as { token?: unknown }).token;
      const user = await verifyToken(token);
      if (!user) {
        socket.emit("error:auth", { message: "Invalid or expired token" });
        return next(new Error("auth"));
      }
      (socket as ClientSocket).data.user = user;
      next();
    } catch (err) {
      logger.error({ err }, "Client auth error");
      next(new Error("auth"));
    }
  });

  ns.on("connection", (socket: ClientSocket) => {
    const user = socket.data.user;
    logger.info({ userId: user.id, socketId: socket.id }, "Client connected");
    orchestrator.clientConnected(socket.id, user.id);

    // -----------------------------------------------------------------------
    // job:create  { jobId, tier, model, messages, maxTokens? }
    // -----------------------------------------------------------------------
    socket.on(
      "job:create",
      async (payload: {
        jobId: string;
        tier: "hover" | "glide";
        model: string;
        messages: ChatMessage[];
        maxTokens?: number;
      }) => {
        if (
          typeof payload?.jobId !== "string" ||
          !payload.model ||
          !Array.isArray(payload.messages)
        ) {
          socket.emit("job:failed", {
            jobId: payload?.jobId ?? "unknown",
            reason: "no_workers",
            refunded: false,
          });
          return;
        }

        try {
          await orchestrator.createJob({
            jobId: payload.jobId,
            userId: user.id,
            clientSocketId: socket.id,
            tier: payload.tier ?? (payload.model === "bee-glide" ? "glide" : "hover"),
            model: payload.model,
            messages: payload.messages,
            maxTokens: payload.maxTokens,
          });
        } catch (err) {
          logger.error({ err, jobId: payload.jobId }, "job:create error");
          socket.emit("job:failed", {
            jobId: payload.jobId,
            reason: "no_workers",
            refunded: false,
          });
        }
      },
    );

    // -----------------------------------------------------------------------
    // job:cancel  { jobId }
    // -----------------------------------------------------------------------
    socket.on("job:cancel", (payload: { jobId: string }) => {
      if (typeof payload?.jobId !== "string") return;
      orchestrator.cancelJob(payload.jobId, user.id);
    });

    // -----------------------------------------------------------------------
    // ping  {}
    // -----------------------------------------------------------------------
    socket.on("ping", () => {
      socket.emit("pong", { ts: Date.now() });
    });

    socket.on("disconnect", () => {
      logger.info({ userId: user.id, socketId: socket.id }, "Client disconnected");
      orchestrator.clientDisconnected(socket.id);
    });
  });
}
