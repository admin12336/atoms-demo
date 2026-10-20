import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { createUser, findUserByEmail, findUserById } from "./db";
import type { PublicUser } from "./types";

const COOKIE = "atoms_session";

function secret() {
  return process.env.AUTH_SECRET || "atoms-demo-dev-secret";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function encodePart(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodePart(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function createSessionToken(user: PublicUser) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 14;
  const body = `${user.id}.${exp}.${encodePart(user.email)}.${encodePart(user.displayName)}`;
  return `${body}.${sign(body)}`;
}

export function parseSessionToken(token: string | undefined | null): PublicUser | null {
  if (!token) return null;
  const parts = token.split(".");
  // new format: id.exp.email.displayName.sig
  if (parts.length === 5) {
    const [userId, expStr, emailEnc, nameEnc, sig] = parts;
    const body = `${userId}.${expStr}.${emailEnc}.${nameEnc}`;
    const expected = sign(body);
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    } catch {
      return null;
    }
    if (Number(expStr) < Date.now()) return null;
    return {
      id: userId,
      email: decodePart(emailEnc),
      displayName: decodePart(nameEnc),
    };
  }

  // legacy format: id.exp.sig
  if (parts.length === 3) {
    const [userId, expStr, sig] = parts;
    const body = `${userId}.${expStr}`;
    const expected = sign(body);
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    } catch {
      return null;
    }
    if (Number(expStr) < Date.now()) return null;
    return { id: userId, email: "", displayName: "用户" };
  }

  return null;
}

export async function setSessionCookie(user: PublicUser) {
  const jar = await cookies();
  jar.set(COOKIE, createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.VERCEL === "1",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  const session = parseSessionToken(token);
  if (!session) return null;

  // Vercel 多实例下本地 JSON 可能丢，用 cookie 恢复用户到内存存储
  let user = await findUserById(session.id);
  if (!user && session.email) {
    user = await findUserByEmail(session.email);
  }
  if (!user && session.email) {
    user = await createUser({
      id: session.id,
      email: session.email,
      displayName: session.displayName || "用户",
      passwordHash: "cookie-restored",
      createdAt: new Date().toISOString(),
    });
  }
  if (!user) return session.email ? session : null;

  return { id: user.id, email: user.email, displayName: user.displayName };
}
