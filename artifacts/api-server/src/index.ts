import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { orchestrator } from "./lib/orchestrator";
import { setupClientNamespace } from "./namespaces/client";
import { setupHiveNamespace } from "./namespaces/hive";
import { setupStatsNamespace } from "./namespaces/stats";
import { startScheduler } from "./lib/scheduler";
import { SOCKET_CORS } from "./lib/security";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Attach Socket.io to the same HTTP server as Express
const httpServer = createServer(app);

const io = new Server(httpServer, {
  path: "/api/socket.io",
  cors: SOCKET_CORS,
  // Allow the shared reverse proxy to forward WebSocket upgrades
  allowEIO3: true,
});

orchestrator.init(io);
setupClientNamespace(io);
setupHiveNamespace(io);
setupStatsNamespace(io);
startScheduler();

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
});
