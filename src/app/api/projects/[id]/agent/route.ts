import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getProject, upsertProject } from "@/lib/db";
import { runBuild, runIterate, runPlan } from "@/lib/llm";
import { fetchBeijingWeather } from "@/lib/weather";
import type { AppVersion, Message } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(["plan", "build", "iterate"]),
  content: z.string().optional(),
});

export async function POST(req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = await getProject(id, user.id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  try {
    const body = schema.parse(await req.json());
    const now = new Date().toISOString();

    let weatherHint = "";
    try {
      const w = await fetchBeijingWeather();
      weatherHint = `${w.city} ${w.label} ${w.temperature}°C 风速${w.windspeed}`;
    } catch {
      weatherHint = "";
    }

    if (body.action === "plan") {
      const idea = (body.content || "").trim();
      if (!idea) return NextResponse.json({ error: "请输入需求" }, { status: 400 });

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
      return NextResponse.json({ project, weatherHint });
    }

    if (body.action === "build") {
      if (!project.plan) {
        return NextResponse.json({ error: "请先生成并确认方案" }, { status: 400 });
      }
      project.status = "building";
      project.messages.push({
        id: randomUUID(),
        role: "system",
        kind: "status",
        content: "Mike：方案已批准，正在调度 Alex 生成可交互页面…",
        createdAt: new Date().toISOString(),
      });
      await upsertProject(project);

      const html = await runBuild(project.plan, weatherHint);
      const version: AppVersion = {
        id: randomUUID(),
        label: `v${project.versions.length + 1}`,
        html,
        createdAt: new Date().toISOString(),
        note: "首次生成",
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
      return NextResponse.json({ project });
    }

    // iterate
    const instruction = (body.content || "").trim();
    if (!instruction) return NextResponse.json({ error: "请输入修改说明" }, { status: 400 });
    const active = project.versions.find((v) => v.id === project.activeVersionId);
    if (!active) return NextResponse.json({ error: "还没有可迭代的版本" }, { status: 400 });

    project.messages.push({
      id: randomUUID(),
      role: "user",
      kind: "chat",
      content: instruction,
      createdAt: new Date().toISOString(),
    });
    project.status = "building";
    await upsertProject(project);

    const html = await runIterate(active.html, instruction);
    const version: AppVersion = {
      id: randomUUID(),
      label: `v${project.versions.length + 1}`,
      html,
      createdAt: new Date().toISOString(),
      note: instruction.slice(0, 80),
    };
    project.versions.push(version);
    project.activeVersionId = version.id;
    project.status = "ready";
    project.messages.push({
      id: randomUUID(),
      role: "assistant",
      kind: "status",
      content: `Alex：已按「${instruction}」产出 ${version.label}。`,
      createdAt: new Date().toISOString(),
    });
    project.updatedAt = new Date().toISOString();
    await upsertProject(project);
    return NextResponse.json({ project });
  } catch (e) {
    project.status = "failed";
    project.messages.push({
      id: randomUUID(),
      role: "system",
      kind: "error",
      content: e instanceof Error ? e.message : "生成失败",
      createdAt: new Date().toISOString(),
    });
    project.updatedAt = new Date().toISOString();
    await upsertProject(project);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "生成失败", project },
      { status: 500 },
    );
  }
}
