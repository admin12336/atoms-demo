import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { listProjects, upsertProject } from "@/lib/db";
import type { Project } from "@/lib/types";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const projects = await listProjects(user.id);
  return NextResponse.json({ projects });
}

const createSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  idea: z.string().min(1).max(2000).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const body = createSchema.parse(await req.json().catch(() => ({})));
    const now = new Date().toISOString();
    const title = body.title?.trim() || body.idea?.slice(0, 30) || "未命名项目";
    const project: Project = {
      id: randomUUID(),
      userId: user.id,
      title,
      status: "idle",
      plan: null,
      messages: body.idea
        ? [
            {
              id: randomUUID(),
              role: "user",
              kind: "chat",
              content: body.idea,
              createdAt: now,
            },
          ]
        : [],
      versions: [],
      activeVersionId: null,
      createdAt: now,
      updatedAt: now,
    };
    await upsertProject(project);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
