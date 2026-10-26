import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getProject, upsertProject } from "@/lib/db";
import { runBuildStreaming, runIterateStreaming, runPlan } from "@/lib/llm";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { newRequestId } from "@/lib/requestId";
import { sseEncode, sseHeaders } from "@/lib/sse";
import { fetchBeijingWeather } from "@/lib/weather";
import type { AppVersion, Message, Project } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["plan", "build", "iterate"]),
  content: z.string().optional(),
  /** build/iterate 默认走 SSE；plan 仍返回 JSON */
  stream: z.boolean().optional(),
});

export async function POST(req: Request, ctx: Ctx) {
  const requestId = newRequestId();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录", requestId }, { status: 401, headers: { "X-Request-Id": requestId } });
  }

  const rl = rateLimit(`agent:${clientKey(req, user.id)}`, 40);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后重试", requestId, retryAfterSec: rl.retryAfterSec },
      {
        status: 429,
        headers: { "X-Request-Id": requestId, "Retry-After": String(rl.retryAfterSec) },
      },
    );
  }

  const { id } = await ctx.params;
  const project = await getProject(id, user.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在", requestId }, { status: 404, headers: { "X-Request-Id": requestId } });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bad request", requestId },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }

  let weatherHint = "";
  try {
    const w = await fetchBeijingWeather();
    weatherHint = `${w.city} ${w.label} ${w.temperature}°C 风速${w.windspeed}`;
  } catch {
    weatherHint = "";
  }

  const wantStream = body.stream !== false && (body.action === "build" || body.action === "iterate");

  if (body.action === "plan") {
    try {
      const idea = (body.content || "").trim();
      if (!idea) {
        return NextResponse.json({ error: "请输入需求", requestId }, { status: 400, headers: { "X-Request-Id": requestId } });
      }
      const now = new Date().toISOString();
      const userMsg: Message = {
        id: randomUUID(),
        role: "user",
        kind: "chat",
        content: idea,
        createdAt: now,
      };
      project.messages.push(userMsg);
      project.status = "planning";
      project.title = idea.slice(0, 30);
      project.updatedAt = now;
      await upsertProject(project);

      const plan = await runPlan(idea, weatherHint);
      const planMsg: Message = {
        id: randomUUID(),
        role: "assistant",
        kind: "plan",
        content: `Emma 已整理方案《${plan.title}》：${plan.summary}`,
        plan,
        createdAt: new Date().toISOString(),
      };
      project.plan = plan;
      project.messages.push(planMsg);
      project.status = "awaiting_approval";
      project.updatedAt = new Date().toISOString();
      await upsertProject(project);
      return NextResponse.json(
        { project, weatherHint, requestId },
        { headers: { "X-Request-Id": requestId } },
      );
    } catch (e) {
      return await failProject(project, e, requestId);
    }
  }

  if (!wantStream) {
    // 兼容旧客户端：非流式 build/iterate
    try {
      if (body.action === "build") {
        await prepareBuild(project);
        const html = await runBuildStreaming(project.plan!, weatherHint);
        await finalizeBuild(project, html, "首次生成");
        return NextResponse.json({ project, requestId }, { headers: { "X-Request-Id": requestId } });
      }
      const instruction = (body.content || "").trim();
      if (!instruction) {
        return NextResponse.json({ error: "请输入修改说明", requestId }, { status: 400, headers: { "X-Request-Id": requestId } });
      }
      const active = project.versions.find((v) => v.id === project.activeVersionId);
      if (!active) {
        return NextResponse.json({ error: "还没有可迭代的版本", requestId }, { status: 400, headers: { "X-Request-Id": requestId } });
      }
      await prepareIterate(project, instruction);
      const html = await runIterateStreaming(active.html, instruction);
      await finalizeBuild(project, html, instruction.slice(0, 80));
      return NextResponse.json({ project, requestId }, { headers: { "X-Request-Id": requestId } });
    } catch (e) {
      return await failProject(project, e, requestId);
    }
  }

  // SSE：build / iterate
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(sseEncode(event, data)));
      };

      const onAbort = () => {
        closed = true;
        try {
          send("error", { message: "客户端已取消（Abort），服务端停止生成", requestId });
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
        send("status", { phase: "start", text: `requestId=${requestId}`, requestId });

        if (body.action === "build") {
          if (!project.plan) {
            send("error", { message: "请先生成并确认方案", requestId });
            send("done", { cancelled: false, ok: false, requestId });
            return;
          }
          await prepareBuild(project);
          send("status", { phase: "building", text: "Mike：方案已批准，正在调度 Alex 流式生成…", requestId });
          const html = await runBuildStreaming(project.plan, weatherHint, {
            signal: req.signal,
            onDelta: (text) => send("message", { text, requestId }),
          });
          if (req.signal.aborted) return;
          await finalizeBuild(project, html, "首次生成");
          send("status", { phase: "ready", text: `Alex：已生成流式版本，可在右侧预览。`, requestId });
          send("done", { cancelled: false, ok: true, project, requestId });
          return;
        }

        // iterate
        const instruction = (body.content || "").trim();
        if (!instruction) {
          send("error", { message: "请输入修改说明", requestId });
          send("done", { cancelled: false, ok: false, requestId });
          return;
        }
        const active = project.versions.find((v) => v.id === project.activeVersionId);
        if (!active) {
          send("error", { message: "还没有可迭代的版本", requestId });
          send("done", { cancelled: false, ok: false, requestId });
          return;
        }
        await prepareIterate(project, instruction);
        send("status", { phase: "iterating", text: "Alex：按你的修改说明流式迭代…", requestId });
        const html = await runIterateStreaming(active.html, instruction, {
          signal: req.signal,
          onDelta: (text) => send("message", { text, requestId }),
        });
        if (req.signal.aborted) return;
        await finalizeBuild(project, html, instruction.slice(0, 80));
        send("status", { phase: "ready", text: `Alex：已按「${instruction}」产出新版本。`, requestId });
        send("done", { cancelled: false, ok: true, project, requestId });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "生成失败";
        project.status = "failed";
        project.messages.push({
          id: randomUUID(),
          role: "system",
          kind: "error",
          content: msg,
          createdAt: new Date().toISOString(),
        });
        project.updatedAt = new Date().toISOString();
        await upsertProject(project);
        send("error", { message: msg, requestId });
        send("done", { cancelled: false, ok: false, project, requestId });
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

async function prepareBuild(project: Project) {
  project.status = "building";
  project.messages.push({
    id: randomUUID(),
    role: "system",
    kind: "status",
    content: "Mike：方案已批准，正在调度 Alex 生成可交互页面…",
    createdAt: new Date().toISOString(),
  });
  await upsertProject(project);
}

async function prepareIterate(project: Project, instruction: string) {
  project.messages.push({
    id: randomUUID(),
    role: "user",
    kind: "chat",
    content: instruction,
    createdAt: new Date().toISOString(),
  });
  project.status = "building";
  await upsertProject(project);
}

async function finalizeBuild(project: Project, html: string, note: string) {
  const version: AppVersion = {
    id: randomUUID(),
    label: `v${project.versions.length + 1}`,
    html,
    createdAt: new Date().toISOString(),
    note,
  };
  project.versions.push(version);
  project.activeVersionId = version.id;
  project.status = "ready";
  project.messages.push({
    id: randomUUID(),
    role: "assistant",
    kind: "status",
    content: `Alex：已生成 ${version.label}，可在右侧预览并继续对话迭代。`,
    createdAt: new Date().toISOString(),
  });
  project.updatedAt = new Date().toISOString();
  await upsertProject(project);
}

async function failProject(project: Project, e: unknown, requestId: string) {
  const msg = e instanceof Error ? e.message : "生成失败";
  project.status = "failed";
  project.messages.push({
    id: randomUUID(),
    role: "system",
    kind: "error",
    content: msg,
    createdAt: new Date().toISOString(),
  });
  project.updatedAt = new Date().toISOString();
  await upsertProject(project);
  return NextResponse.json(
    { error: msg, project, requestId },
    { status: 500, headers: { "X-Request-Id": requestId } },
  );
}
