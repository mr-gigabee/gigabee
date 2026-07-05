import type { Server } from "socket.io";

/**
 * Public /stats namespace — no authentication required.
 * The orchestrator broadcasts worker/job counts here every 5 s.
 * Any visitor (including unauthenticated landing-page users) can subscribe.
 */
export function setupStatsNamespace(io: Server): void {
  io.of("/stats");
}
