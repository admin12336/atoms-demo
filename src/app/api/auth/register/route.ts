import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser, findUserByEmail } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { randomUUID } from "crypto";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1).max(40),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const exists = await findUserByEmail(body.email);
    if (exists) {
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
    }
    const user = await createUser({
      id: randomUUID(),
      email: body.email.toLowerCase(),
      displayName: body.displayName.trim(),
      passwordHash: await hashPassword(body.password),
      createdAt: new Date().toISOString(),
    });
    const publicUser = { id: user.id, email: user.email, displayName: user.displayName };
    await setSessionCookie(publicUser);
    return NextResponse.json({ user: publicUser });
  } catch (e) {
    const message = e instanceof Error ? e.message : "注册失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
