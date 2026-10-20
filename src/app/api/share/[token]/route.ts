import { NextResponse } from "next/server";
import { getShare } from "@/lib/db";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const share = await getShare(token);
  if (!share) return NextResponse.json({ error: "分享不存在或已失效" }, { status: 404 });
  return NextResponse.json({ share });
}
