import { Router, type IRouter, type Request, type Response } from "express";
import healthRouter from "./health";
import statsRouter from "./stats";
import authRouter from "./auth";
import authWalletRouter from "./auth-wallet";
import creditsRouter from "./credits";
import chatRouter from "./chat";
import workersRouter from "./workers";
import earningsRouter from "./earnings";
import referralsRouter from "./referrals";
import adminRouter from "./admin";
import apiKeysRouter from "./api-keys";
import solanaRpcRouter from "./solana-rpc";
import v1Router from "./v1";

const router: IRouter = Router();

router.use(healthRouter);
router.use(statsRouter);
router.use(authRouter);
router.use(authWalletRouter);
router.use(creditsRouter);
router.use(chatRouter);
router.use(workersRouter);
router.use(earningsRouter);
router.use(referralsRouter);
router.use(adminRouter);
router.use(apiKeysRouter);
router.use(solanaRpcRouter);
router.use(v1Router);

// Catch-all: any unmatched /api/* returns JSON 404
router.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

export default router;
