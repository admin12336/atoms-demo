import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteProject, getProject, upsertProject } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = await getProject(id, user.id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = await getProject(id, user.id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const body = await req.json();
  if (typeof body.activeVersionId === "string") {
    const version = project.versions.find((v) => v.id === body.activeVersionId);
    if (!version) return NextResponse.json({ error: "版本不存在" }, { status: 404 });
    project.activeVersionId = version.id;
    project.updatedAt = new Date().toISOString();
    await upsertProject(project);
  }
  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const ok = await deleteProject(id, user.id);
  if (!ok) return NextResponse.json({ error: "删除失败" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
