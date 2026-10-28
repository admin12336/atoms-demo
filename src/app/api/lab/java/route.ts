import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { newRequestId } from "@/lib/requestId";

/**
 * Java / Spring Boot 风格统一响应契约演示
 * { code, message, data, requestId } —— 对应简历里 Java 后端接口口径
 */

const schema = z.object({
  action: z.enum(["echo", "park_metrics", "health"]).default("echo"),
  keyword: z.string().max(40).optional(),
});

export async function GET() {
  const requestId = newRequestId();
  return NextResponse.json(
    {
      code: 0,
      message: "ok",
      data: {
        style: "Spring Boot Result<T>",
        endpoints: ["GET /api/lab/java", "POST /api/lab/java"],
        note: "演示 Java 统一返回体：code/message/data/requestId",
      },
      requestId,
    },
    { headers: { "X-Request-Id": requestId } },
  );
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const requestId = newRequestId();
  const rl = rateLimit(`lab-java:${clientKey(req)}`, 40);
  if (!rl.ok) {
    return NextResponse.json(
      { code: 429, message: "限流", data: null, requestId, retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "X-Request-Id": requestId, "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  try {
    const body = schema.parse(await req.json().catch(() => ({ action: "echo" })));

    if (body.action === "health") {
      return NextResponse.json(
        {
          code: 0,
          message: "UP",
          data: {
            status: "UP",
            javaStyle: true,
            checks: { db: "UP", redis: "UP(mock)", llm: "DEGRADED_OK" },
            note: "演示 Spring Boot 健康检查口径；本 Lab 宿主为 Next.js，契约形态对齐 Java 后端。",
          },
          requestId,
          latencyMs: Date.now() - started,
        },
        { headers: { "X-Request-Id": requestId } },
      );
    }

    if (body.action === "park_metrics") {
      return NextResponse.json(
        {
          code: 0,
          message: "ok",
          data: {
            project: "产业园区可视化驾驶舱",
            resumeProject: "产业园区可视化驾驶舱",
            metrics: [
              { name: "入驻企业", value: 1286, unit: "家", trend: "+12" },
              { name: "本月产值", value: 3.42, unit: "亿元", trend: "+0.18" },
              { name: "今日访客", value: 932, unit: "人", trend: "+46" },
            ],
            cache: "Redis mock hit",
            sqlHint: "预聚合 + 索引，避免大屏直扫明细表",
          },
          requestId,
          latencyMs: Date.now() - started,
        },
        { headers: { "X-Request-Id": requestId } },
      );
    }

    return NextResponse.json(
      {
        code: 0,
        message: "ok",
        data: {
          echo: body.keyword || "hello-java",
          contract: "Result<T> = { code, message, data, requestId }",
          stack: ["Java", "Spring Boot", "MyBatis", "MySQL", "Redis"],
          frontend: ["TypeScript", "React", "Next.js"],
          ai: ["SSE", "RAG", "Agent", "Research→Planner"],
          note: "统一返回体便于前后端联调与网关观测；面试可对标 Spring Boot Controller 出参约定。",
        },
        requestId,
        latencyMs: Date.now() - started,
      },
      { headers: { "X-Request-Id": requestId } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        code: 400,
        message: e instanceof Error ? e.message : "bad request",
        data: null,
        requestId,
        latencyMs: Date.now() - started,
      },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }
}
