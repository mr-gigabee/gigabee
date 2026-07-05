import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { jobsTable, earningsLedgerTable } from "@workspace/db";
import { sql, gte } from "drizzle-orm";
import { GetNetworkStatsResponse } from "@workspace/api-zod";
import { orchestrator } from "../lib/orchestrator";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  const since14d    = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const workersOnline = orchestrator.getOnlineWorkerCount();

  const [jobsRecentResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobsTable)
    .where(gte(jobsTable.createdAt, startOfHour));

  const [honeyResult] = await db
    .select({ total: sql<number>`coalesce(sum(usd_micro), 0)::bigint` })
    .from(earningsLedgerTable);

  const [tokensResult] = await db
    .select({
      total: sql<number>`coalesce(sum(coalesce(${jobsTable.promptTokens},0) + coalesce(${jobsTable.completionTokens},0)), 0)::bigint`,
    })
    .from(jobsTable);

  const [modelsResult] = await db
    .select({ count: sql<number>`count(distinct ${jobsTable.model})::int` })
    .from(jobsTable)
    .where(gte(jobsTable.createdAt, startOfHour));

  // Daily breakdown — last 14 days
  const dailyRows = await db
    .select({
      day:    sql<string>`date(${jobsTable.createdAt})::text`,
      jobs:   sql<number>`count(*)::int`,
      tokens: sql<number>`coalesce(sum(coalesce(${jobsTable.promptTokens},0) + coalesce(${jobsTable.completionTokens},0)), 0)::int`,
    })
    .from(jobsTable)
    .where(gte(jobsTable.createdAt, since14d))
    .groupBy(sql`date(${jobsTable.createdAt})`)
    .orderBy(sql`date(${jobsTable.createdAt})`);

  // By-model breakdown — all time
  const byModelRows = await db
    .select({
      model:  jobsTable.model,
      jobs:   sql<number>`count(*)::int`,
      tokens: sql<number>`coalesce(sum(coalesce(${jobsTable.promptTokens},0) + coalesce(${jobsTable.completionTokens},0)), 0)::int`,
    })
    .from(jobsTable)
    .groupBy(jobsTable.model)
    .orderBy(sql`count(*) desc`);

  const honeyPaidOutUsd = Number(honeyResult?.total ?? 0) / 1_000_000;

  res.json(
    GetNetworkStatsResponse.parse({
      workersOnline,
      jobsToday:       jobsRecentResult?.count ?? 0,
      honeyPaidOutUsd,
      tokensGenerated: Number(tokensResult?.total ?? 0),
      activeModels:    modelsResult?.count ?? 0,
      daily:   dailyRows.map(r => ({ day: r.day, jobs: r.jobs, tokens: r.tokens })),
      byModel: byModelRows.map(r => ({ model: r.model, jobs: r.jobs, tokens: r.tokens })),
    }),
  );
});

export default router;
