import { Router, type IRouter } from "express";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import nacl from "tweetnacl";
import bs58 from "bs58";

const router: IRouter = Router();

const MESSAGE_PREFIX = "Sign in to Gigabee\nTimestamp: ";
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

function generateReferralCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "bee-";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code + "-" + Math.random().toString(36).slice(2, 6);
}

/**
 * POST /api/auth/wallet
 * Body: { address: string, signature: string (base64), timestamp: number }
 */
router.post("/auth/wallet", async (req, res): Promise<void> => {
  const { address, signature, timestamp } = req.body ?? {};

  if (
    typeof address !== "string" ||
    typeof signature !== "string" ||
    typeof timestamp !== "number"
  ) {
    res.status(400).json({ error: "address, signature, and timestamp are required" });
    return;
  }

  // Reject stale timestamps (replay protection)
  if (Math.abs(Date.now() - timestamp) > MAX_AGE_MS) {
    res.status(401).json({ error: "Timestamp expired. Please try again." });
    return;
  }

  let publicKeyBytes: Uint8Array;
  let signatureBytes: Uint8Array;

  try {
    publicKeyBytes = bs58.decode(address);
    signatureBytes = Buffer.from(signature, "base64");
  } catch {
    res.status(400).json({ error: "Invalid address or signature encoding" });
    return;
  }

  const message = new TextEncoder().encode(`${MESSAGE_PREFIX}${timestamp}`);

  const valid = nacl.sign.detached.verify(message, signatureBytes, publicKeyBytes);
  if (!valid) {
    res.status(401).json({ error: "Signature verification failed" });
    return;
  }

  let [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.solanaAddress, address));

  if (!user) {
    const syntheticEmail = `solana-${address.slice(0, 12).toLowerCase()}@wallet.gigabee`;
    const referralCode = generateReferralCode();

    [user] = await db
      .insert(usersTable)
      .values({
        email: syntheticEmail,
        solanaAddress: address,
        authProvider: "solana_wallet",
        referralCode,
      })
      .returning();
  }

  const sessionToken = crypto.randomUUID() + "-" + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId: user.id, token: sessionToken, expiresAt });

  req.log.info({ userId: user.id, address }, "Solana wallet auth successful");

  res.json({
    user: { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() },
    sessionToken,
  });
});

export default router;
