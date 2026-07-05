/**
 * Temporary in-memory store for generated images.
 * Images expire after 15 minutes and are served via /api/chat/image/:id
 */
const cache = new Map<string, { buf: Buffer; exp: number }>();
const TTL_MS = 15 * 60 * 1000;

export function storeImage(id: string, buf: Buffer): void {
  cache.set(id, { buf, exp: Date.now() + TTL_MS });
}

export function getImage(id: string): Buffer | null {
  const entry = cache.get(id);
  if (!entry) return null;
  if (Date.now() > entry.exp) {
    cache.delete(id);
    return null;
  }
  return entry.buf;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now > v.exp) cache.delete(k);
  }
}, 5 * 60 * 1000).unref();
