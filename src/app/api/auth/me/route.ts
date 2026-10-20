import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { llmMode } from "@/lib/llm";

export async function GET() {
  const user = await getCurrentUser();
  let mode: "live" | "demo" | "unset" = "unset";
  try {
    mode = llmMode();
  } catch {
    mode = "unset";
  }
  return NextResponse.json({ user, llmMode: mode });
}
