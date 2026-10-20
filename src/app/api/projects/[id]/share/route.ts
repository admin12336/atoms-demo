import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { createShare, getProject } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = await getProject(id, user.id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const version = project.versions.find((v) => v.id === project.activeVersionId);
  if (!version) return NextResponse.json({ error: "没有可分享的版本" }, { status: 400 });

  const token = randomBytes(9).toString("hex");
  await createShare(token, {
    projectId: project.id,
    versionId: version.id,
    html: version.html,
    title: project.title,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ token, path: `/share/${token}` });
}
