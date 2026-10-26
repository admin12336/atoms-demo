import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { llmMode, streamLabNarrative } from "@/lib/llm";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { newRequestId } from "@/lib/requestId";
import { sleep, sseEncode, sseHeaders } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postSchema = z.object({
  topic: z.string().min(1).max(80).optional(),
  /** 强制 demo 假流（即使有 Key），用于演示协议 */
  forceDemoStream: z.boolean().optional(),
});

/** GET：兼容旧 Lab；POST + JSON Body：对应「EventSource 不能带 Body」口径 */
export async function GET(req: NextRequest) {
  const topic = (req.nextUrl.searchParams.get("topic") || "行程规划").slice(0, 40);
  return runSse(req, topic, false);
}

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const rl = rateLimit(`lab-sse:${clientKey(req)}`, 30);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "限流", requestId, retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "X-Request-Id": requestId, "Retry-After": String(rl.retryAfterSec) } },
    );
  }
  try {
    const body = postSchema.parse(await req.json().catch(() => ({})));
    return runSse(req, (body.topic || "行程规划").slice(0, 40), Boolean(body.forceDemoStream), requestId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bad request", requestId },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }
}

function runSse(req: NextRequest, topic: string, forceDemo: boolean, requestId = newRequestId()) {
  const rl = rateLimit(`lab-sse:${clientKey(req)}`, 30);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "限流", requestId, retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "X-Request-Id": requestId, "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const encoder = new TextEncoder();
  let closed = false;
  const mode = forceDemo ? "demo" : llmMode();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(sseEncode(event, data)));
      };

      const onAbort = () => {
        closed = true;
        try {
          send("error", { message: "客户端已取消（Abort），服务端停止推送", requestId });
          send("done", { cancelled: true, requestId });
        } catch {
          /* ignore */
        }
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };
      req.signal.addEventListener("abort", onAbort);

      try {
        send("status", {
          phase: "research",
          text: `Research：收集「${topic}」约束与摘要…`,
          requestId,
          llmMode: mode,
        });
        await sleep(280, req.signal);
        send("message", {
          text: `协议：POST+JSON Body SSE（非 EventSource）；requestId=${requestId}`,
          requestId,
        });
        await sleep(220, req.signal);
        send("status", { phase: "planner", text: "Planner：流式输出正文…", requestId });

        if (forceDemo || mode === "demo") {
          const chunks = [
            `## ${topic}（演示流式）\n`,
            "Day1 上午：核心景点 A（可渲染实体）\n",
            "Day1 下午：街区漫步 B\n",
            "说明：此为 demo 假流；配置 OPENAI_API_KEY 且不强制 demo 时走真模型流。\n",
          ];
          for (const c of chunks) {
            if (req.signal.aborted) break;
            send("message", { text: c, requestId });
            await sleep(280, req.signal);
          }
        } else {
          await streamLabNarrative(topic, {
            signal: req.signal,
            onDelta: (text) => send("message", { text, requestId }),
          });
        }

        if (!req.signal.aborted) {
          send("done", { cancelled: false, ok: true, requestId, llmMode: mode });
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          send("error", { message: (e as Error).message || "stream error", requestId });
          send("done", { cancelled: false, ok: false, requestId });
        }
      } finally {
        req.signal.removeEventListener("abort", onAbort);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* ignore */
          }
        }
      }
    },
  });

  return new Response(stream, { headers: sseHeaders(requestId) });
}
