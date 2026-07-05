/**
 * POST /api/solana-rpc
 *
 * Thin proxy that forwards JSON-RPC calls to the configured Solana RPC
 * endpoint. Using a server-side proxy keeps the actual RPC URL (and any
 * embedded API key) out of the browser bundle.
 */

import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

function resolveRpcUrl(): string {
  const heliusKey = process.env["HELIUS_API_KEY"];
  if (heliusKey) return `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
  return process.env["SOLANA_RPC_URL"] ?? "https://api.mainnet-beta.solana.com";
}

const RPC_URL = resolveRpcUrl();

router.post("/solana-rpc", async (req: Request, res: Response): Promise<void> => {
  try {
    const upstream = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json() as unknown;
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({
      jsonrpc: "2.0",
      error: { code: -32603, message: "RPC proxy error" },
      id: null,
    });
  }
});

export default router;
