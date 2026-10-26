import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  goal: z.string().min(1).max(120),
  /** 模拟外部检索耗时（ms），用于演示软超时 */
  researchDelayMs: z.number().int().min(0).max(8000).optional(),
  softTimeoutMs: z.number().int().min(500).max(5000).optional(),
});

type ResearchResult =
  | { ok: true; summary: string; elapsedMs: number }
  | { ok: false; reason: "soft_timeout" | "empty"; elapsedMs: number };

async function research(goal: string, delayMs: number, softTimeoutMs: number): Promise<ResearchResult> {
  const started = Date.now();
  const work = new Promise<ResearchResult>((resolve) => {
    setTimeout(() => {
      resolve({
        ok: true,
        summary: `检索摘要（演示）：与「${goal}」相关的开放域要点已写入上下文；非实时票价/营业时间需边界声明。`,
        elapsedMs: Date.now() - started,
      });
    }, delayMs);
  });

  const timeout = new Promise<ResearchResult>((resolve) => {
    setTimeout(() => {
      resolve({
        ok: false,
        reason: "soft_timeout",
        elapsedMs: Date.now() - started,
      });
    }, softTimeoutMs);
  });

  return Promise.race([work, timeout]);
}

function plan(goal: string, research: ResearchResult) {
  const usedResearch = research.ok;
  return {
    title: `${goal} · 两阶段方案`,
    phases: [
      {
        name: "Research",
        status: usedResearch ? "ok" : "skipped",
        detail: usedResearch
          ? research.summary
          : `软超时（${research.elapsedMs}ms）跳过检索，主链路不阻塞。`,
      },
      {
        name: "Planner",
        status: "ok",
        detail: usedResearch
          ? "基于摘要生成结构化行程骨架（时段 / 实体字段）。"
          : "无摘要降级：输出城市基础行程骨架，并在边界中声明资料有限。",
      },
    ],
    outputContract: {
      days: [
        {
          day: 1,
          slots: [
            { time: "上午", place: "核心景点 A", note: "可渲染实体" },
            { time: "下午", place: "街区 B", note: "可渲染实体" },
          ],
        },
      ],
      disclaimer: "幻觉只能降概率；非实时票价/营业时间以现场为准。",
    },
  };
}

/** Research→Planner 两阶段 + 软超时演示（无真实模型 Key 也可跑） */
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const delay = body.researchDelayMs ?? 800;
    const soft = body.softTimeoutMs ?? 3000;
    const researchResult = await research(body.goal, delay, soft);
    const result = plan(body.goal, researchResult);
    return NextResponse.json({
      goal: body.goal,
      softTimeoutMs: soft,
      researchDelayMs: delay,
      research: researchResult,
      plan: result,
      note: "对应简历 TripPal：两阶段编排 + 约 3s 软超时；超时跳过检索继续规划。",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bad request" },
      { status: 400 },
    );
  }
}
