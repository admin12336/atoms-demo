import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encode(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** SSE 流式演示：status/message/error/done + 支持 Abort 取消 */
export async function GET(req: NextRequest) {
  const topic = (req.nextUrl.searchParams.get("topic") || "行程规划").slice(0, 40);
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(encode(event, data)));
      };

      const onAbort = () => {
        closed = true;
        try {
          send("error", { message: "客户端已取消（Abort），服务端停止推送" });
          send("done", { cancelled: true });
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
        send("status", { phase: "research", text: `Research：收集「${topic}」约束与摘要…` });
        await sleep(450, req.signal);
        send("message", { text: `已设定软超时约 3s；外部检索失败将跳过并继续规划。` });
        await sleep(400, req.signal);
        send("status", { phase: "planner", text: "Planner：生成结构化输出契约…" });
        await sleep(500, req.signal);

        const chunks = [
          `## ${topic}（演示流式）\n`,
          "Day1 上午：核心景点 A（可渲染实体）\n",
          "Day1 下午：街区漫步 B\n",
          "说明：此流为工程演示，不调用真实大模型；协议与 TripPal SSE 一致。\n",
        ];
        for (const c of chunks) {
          if (req.signal.aborted) break;
          send("message", { text: c });
          await sleep(320, req.signal);
        }

        if (!req.signal.aborted) {
          send("done", { cancelled: false, ok: true });
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          send("error", { message: (e as Error).message || "stream error" });
          send("done", { cancelled: false, ok: false });
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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      return;
    }
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
