import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail } from "@/lib/db";
import { setSessionCookie, verifyPassword } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const user = await findUserByEmail(body.email);
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    }
    const publicUser = { id: user.id, email: user.email, displayName: user.displayName };
    await setSessionCookie(publicUser);
    return NextResponse.json({ user: publicUser });
  } catch (e) {
    const message = e instanceof Error ? e.message : "登录失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
