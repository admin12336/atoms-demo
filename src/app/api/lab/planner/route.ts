import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateItineraryContract } from "@/lib/lab/contract";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { newRequestId } from "@/lib/requestId";

const schema = z.object({
  goal: z.string().min(1).max(120),
  /** 模拟外部检索耗时（ms）——仅生产降级路径使用 */
  researchDelayMs: z.number().int().min(0).max(8000).optional(),
  softTimeoutMs: z.number().int().min(500).max(5000).optional(),
  /**
   * mock_whitelist：白名单演示预制摘要，不跑竞态超时（≠生产降级）
   * live_research：模拟外部检索 + 软超时跳过（生产降级）
   */
  researchMode: z.enum(["mock_whitelist", "live_research"]).optional(),
  /** 注入跳点脏数据以演示契约校验 */
  injectGeoJump: z.boolean().optional(),
});

type ResearchResult =
  | { ok: true; summary: string; elapsedMs: number; source: "mock_whitelist" | "live_research" }
  | {
      ok: false;
      reason: "soft_timeout" | "empty";
      elapsedMs: number;
      source: "live_research";
    };

async function researchLive(
  goal: string,
  delayMs: number,
  softTimeoutMs: number,
): Promise<ResearchResult> {
  const started = Date.now();
  const work = new Promise<ResearchResult>((resolve) => {
    setTimeout(() => {
      resolve({
        ok: true,
        summary: `检索摘要（live）：与「${goal}」相关的开放域要点已写入上下文；非实时票价/营业时间需边界声明。`,
        elapsedMs: Date.now() - started,
        source: "live_research",
      });
    }, delayMs);
  });

  const timeout = new Promise<ResearchResult>((resolve) => {
    setTimeout(() => {
      resolve({
        ok: false,
        reason: "soft_timeout",
        elapsedMs: Date.now() - started,
        source: "live_research",
      });
    }, softTimeoutMs);
  });

  return Promise.race([work, timeout]);
}

function researchMock(goal: string): ResearchResult {
  return {
    ok: true,
    summary: `【白名单 Mock】预制摘要：${goal}；不调用外部检索、不计入软超时。与生产降级开关隔离。`,
    elapsedMs: 0,
    source: "mock_whitelist",
  };
}

function plan(goal: string, research: ResearchResult, injectGeoJump: boolean) {
  const usedResearch = research.ok;
  const days = [
    {
      day: 1,
      slots: [
        { time: "上午", place: "核心景点 A", note: "可渲染实体", city: "上海" },
        injectGeoJump
          ? { time: "下午", place: "远郊跨城点", note: "脏数据", city: "杭州" }
          : { time: "下午", place: "街区 B", note: "可渲染实体", city: "上海" },
      ],
    },
  ];

  const contract = validateItineraryContract(days);

  return {
    title: `${goal} · 两阶段方案`,
    phases: [
      {
        name: "Research",
        status: usedResearch ? "ok" : "skipped",
        detail: usedResearch
          ? research.summary
          : `软超时（${research.elapsedMs}ms）跳过检索，主链路不阻塞（生产降级）。`,
        source: research.source,
      },
      {
        name: "Planner",
        status: "ok",
        detail: usedResearch
          ? "基于摘要生成结构化行程骨架（时段 / 实体字段）。"
          : "无摘要降级：输出城市基础行程骨架，并在边界中声明资料有限。",
      },
      {
        name: "ContractGuard",
        status: contract.ok ? "ok" : "failed",
        detail: contract.issues.length
          ? contract.issues.map((i) => `${i.code}: ${i.message}`).join("；")
          : "字段契约通过；无跳点告警。",
      },
    ],
    outputContract: {
      days: contract.rewritten || days,
      disclaimer: "幻觉只能降概率；非实时票价/营业时间以现场为准。",
      validation: contract,
    },
    switches: {
      mockWhitelist: research.source === "mock_whitelist",
      productionSoftTimeoutDegrade: research.source === "live_research" && !research.ok,
      note: "Mock 白名单 ≠ 生产软超时降级，开关必须隔离。",
    },
  };
}

/** Research→Planner 两阶段 + Mock/软超时分离 + 输出契约校验 */
export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const rl = rateLimit(`lab-planner:${clientKey(req)}`, 40);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "限流", requestId, retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "X-Request-Id": requestId, "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  try {
    const body = schema.parse(await req.json());
    const mode = body.researchMode ?? "live_research";
    const delay = body.researchDelayMs ?? 800;
    const soft = body.softTimeoutMs ?? 3000;
    const researchResult =
      mode === "mock_whitelist" ? researchMock(body.goal) : await researchLive(body.goal, delay, soft);
    const result = plan(body.goal, researchResult, Boolean(body.injectGeoJump));
    return NextResponse.json(
      {
        goal: body.goal,
        researchMode: mode,
        softTimeoutMs: soft,
        researchDelayMs: delay,
        research: researchResult,
        plan: result,
        requestId,
        note: "Mock 白名单与软超时降级分离；ContractGuard 演示跳点改写。",
      },
      { headers: { "X-Request-Id": requestId } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bad request", requestId },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }
}
