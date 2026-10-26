import { randomUUID } from "crypto";

export function newRequestId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

export function withRequestId(headers: HeadersInit = {}, requestId?: string): Headers {
  const h = new Headers(headers);
  h.set("X-Request-Id", requestId || newRequestId());
  return h;
}
