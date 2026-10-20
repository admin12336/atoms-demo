import { NextResponse } from "next/server";
import { fetchBeijingWeather } from "@/lib/weather";

export async function GET() {
  try {
    const weather = await fetchBeijingWeather();
    return NextResponse.json({ weather });
  } catch (e) {
    const message = e instanceof Error ? e.message : "天气获取失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
