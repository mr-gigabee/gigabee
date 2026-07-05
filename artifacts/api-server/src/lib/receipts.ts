import { createHmac } from "crypto";

const SECRET = process.env.SESSION_SECRET ?? "dev-secret";

/**
 * Signs an earning record so workers can independently verify
 * their accumulated balance hasn't been tampered with.
 *
 * Format: v1.<base64(payload)>.<hmac-sha256>
 * Payload: "<workerId>:<jobId>:<usdMicro>:<timestampMs>"
 */
export function signEarningReceipt(params: {
  workerId: string;
  jobId: string;
  usdMicro: number;
  timestampMs: number;
}): string {
  const payload = `${params.workerId}:${params.jobId}:${params.usdMicro}:${params.timestampMs}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  const encoded = Buffer.from(payload).toString("base64url");
  return `v1.${encoded}.${sig}`;
}

/**
 * Verifies a receipt produced by signEarningReceipt.
 * Returns the decoded payload on success, null on any mismatch.
 */
export function verifyEarningReceipt(receipt: string): {
  workerId: string;
  jobId: string;
  usdMicro: number;
  timestampMs: number;
} | null {
  const parts = receipt.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;

  try {
    const [, encoded, sig] = parts as [string, string, string];
    const payload = Buffer.from(encoded, "base64url").toString("utf8");
    const expected = createHmac("sha256", SECRET).update(payload).digest("hex");
    if (sig !== expected) return null;

    const [workerId, jobId, usdMicroStr, tsStr] = payload.split(":");
    if (!workerId || !jobId || !usdMicroStr || !tsStr) return null;

    return {
      workerId,
      jobId,
      usdMicro: Number(usdMicroStr),
      timestampMs: Number(tsStr),
    };
  } catch {
    return null;
  }
}
