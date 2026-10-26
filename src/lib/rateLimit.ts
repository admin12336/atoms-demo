type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** 简易内存限流：默认每分钟 40 次（演示用，进程内有效） */
export function rateLimit(
  key: string,
  limit = 40,
  windowMs = 60_000,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now >= cur.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (cur.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
  }
  cur.count += 1;
  return { ok: true };
}

export function clientKey(req: Request, userId?: string): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || "local";
  return userId ? `${userId}:${ip}` : ip;
}
