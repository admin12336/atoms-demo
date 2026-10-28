import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { newRequestId } from "@/lib/requestId";
import { answerFromHits, searchDocs } from "@/lib/lab/bm25";

/**
 * 业务机器人（对齐简历：知识库问答 + 表单填表 + 行程助手 + 审批查询）
 * 无 Key 可跑：规则路由 + 本地工具
 */

const schema = z.object({
  message: z.string().min(1).max(200),
});

type BotPayload = {
  requestId: string;
  intent: string;
  resumeProject: string;
  steps: Array<{ role: string; text: string }>;
  reply: string;
  suggestions: string[];
  latencyMs: number;
  slots?: Record<string, string>;
  cited?: string[];
};

function ok(
  started: number,
  payload: Omit<BotPayload, "latencyMs">,
) {
  const { requestId, ...rest } = payload;
  return NextResponse.json(
    { requestId, ...rest, latencyMs: Date.now() - started },
    { headers: { "X-Request-Id": requestId } },
  );
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const requestId = newRequestId();
  const rl = rateLimit(`lab-bot:${clientKey(req)}`, 40);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "限流", requestId, retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "X-Request-Id": requestId } },
    );
  }

  try {
    const body = schema.parse(await req.json());
    const msg = body.message.trim();
    const lower = msg.toLowerCase();
    const steps: Array<{ role: string; text: string }> = [];
    const suggestions = ["上海三日游", "故障码 E42", "查询公司 grkj", "档案审批进度"];

    steps.push({ role: "router", text: "意图识别中…" });

    if (/行程|旅游|规划|几日|两日|三日/.test(msg)) {
      steps.push({ role: "tool", text: "调用 Planner（Research→Planner 演示骨架）" });
      steps.push({ role: "guard", text: "地理约束清洗 + 输出契约校验" });
      return ok(started, {
        requestId,
        intent: "trip_planner",
        resumeProject: "TripPal 智能旅行规划 SDK",
        steps,
        suggestions: ["杭州亲子两日游", "故障码 E42", "档案审批进度"],
        reply:
          `已按两阶段生成「${msg}」骨架：Day1 上午核心景点 / 下午街区；Day2 博物馆 + 休闲。` +
          `检索软超时约 3s；通过提示词约束、检索证据锚定与业务规则清洗降低幻觉风险；票价以现场为准。`,
      });
    }

    if (/公司|查询|填表|信用|grkj/.test(msg) || lower.includes("grkj")) {
      steps.push({ role: "tool", text: "调用 lookupCompany（槽位 + 工具）" });
      const name = lower.includes("grkj") || msg.includes("国锐") ? "grkj" : "深度赋智";
      return ok(started, {
        requestId,
        intent: "form_agent",
        resumeProject: "政务招商表单材料智能填充 Agent",
        steps,
        suggestions: ["再查公司 深度赋智", "档案审批进度", "上海三日游"],
        reply: `已回填槽位，可人工二次编辑后提交。companyName=${name}，creditCode=91110000DEMO0001X，contact=张工。`,
        slots: { companyName: name, creditCode: "91110000DEMO0001X", contact: "张工" },
      });
    }

    if (/故障|E42|维保|手册|SSE|软超时|资料/.test(msg) || /e\d+/i.test(msg)) {
      steps.push({ role: "tool", text: "调用迷你 RAG（BM25 + 引用）" });
      const hits = searchDocs(msg, 3);
      const { answer, cited } = answerFromHits(msg, hits);
      return ok(started, {
        requestId,
        intent: "rag_bot",
        resumeProject: "工程机械私有知识库问答 / H5 门户",
        steps,
        suggestions: ["SSE 为什么要 Abort", "查询公司 grkj", "档案审批进度"],
        reply: answer,
        cited,
      });
    }

    if (/审批|档案|扶持|申报/.test(msg)) {
      steps.push({ role: "tool", text: "查询审批状态机（演示）" });
      steps.push({ role: "auth", text: "行级权限校验：仅本人可见" });
      return ok(started, {
        requestId,
        intent: "archive_flow",
        resumeProject: "园区企业扶持政策档案审批后台",
        steps,
        suggestions: ["查询公司 grkj", "故障码 E42", "上海三日游"],
        reply:
          "当前演示单：已提交 → 初审通过 → 待终审。行级权限仅本人可见；状态变更走事务，支持退回重提与版本留存。",
      });
    }

    steps.push({ role: "fallback", text: "未命中专用工具，返回能力菜单" });
    return ok(started, {
      requestId,
      intent: "menu",
      resumeProject: "Atoms Lab 综合演示",
      steps,
      suggestions,
      reply:
        "我是简历能力演示机器人。可试：①「上海三日游」→ TripPal；②「故障码 E42」→ 知识库 RAG；③「查询公司 grkj」→ 填表 Agent；④「档案审批进度」→ 审批后台。也可点下方 Java / SSE / Planner 模块深潜。",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bad request", requestId },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }
}
