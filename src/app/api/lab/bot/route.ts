import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { newRequestId } from "@/lib/requestId";
import { answerFromHits, searchDocs } from "@/lib/lab/bm25";

/**
 * 业务机器人（对齐简历：知识库问答机器人 + 表单填表机器人 + 行程助手）
 * 无 Key 可跑：规则路由 + 本地工具
 */

const schema = z.object({
  message: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
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

    steps.push({ role: "router", text: "意图识别中…" });

    // 行程助手 → TripPal 口径
    if (/行程|旅游|规划|几日|两日|三日/.test(msg)) {
      steps.push({ role: "tool", text: "调用 Planner 工具（Research→Planner 演示骨架）" });
      return NextResponse.json(
        {
          requestId,
          intent: "trip_planner",
          resumeProject: "TripPal 智能旅行规划 SDK",
          steps,
          reply:
            `已按两阶段生成「${msg}」骨架：Day1 上午核心景点 / 下午街区；检索软超时约 3s；非实时票价以现场为准（幻觉只能降概率）。`,
        },
        { headers: { "X-Request-Id": requestId } },
      );
    }

    // 填表机器人
    if (/公司|查询|填表|信用|grkj/.test(msg) || lower.includes("grkj")) {
      steps.push({ role: "tool", text: "调用 lookupCompany（槽位 + 工具）" });
      const name = lower.includes("grkj") || msg.includes("国锐") ? "grkj" : "深度赋智";
      return NextResponse.json(
        {
          requestId,
          intent: "form_agent",
          resumeProject: "政务招商表单材料智能填充 Agent",
          steps,
          reply: `已回填槽位：companyName=${name}，creditCode=91110000DEMO0001X，contact=张工。可人工二次编辑后提交。`,
          slots: { companyName: name, creditCode: "91110000DEMO0001X", contact: "张工" },
        },
        { headers: { "X-Request-Id": requestId } },
      );
    }

    // 知识库机器人
    if (/故障|E42|维保|手册|SSE|软超时|资料/.test(msg) || /e\d+/i.test(msg)) {
      steps.push({ role: "tool", text: "调用迷你 RAG（BM25）" });
      const hits = searchDocs(msg, 3);
      const { answer, cited } = answerFromHits(msg, hits);
      return NextResponse.json(
        {
          requestId,
          intent: "rag_bot",
          resumeProject: "工程机械私有知识库问答 / H5 门户",
          steps,
          reply: answer,
          cited,
        },
        { headers: { "X-Request-Id": requestId } },
      );
    }

    // 档案审批
    if (/审批|档案|扶持|申报/.test(msg)) {
      steps.push({ role: "tool", text: "查询审批状态机（演示）" });
      return NextResponse.json(
        {
          requestId,
          intent: "archive_flow",
          resumeProject: "园区企业扶持政策档案审批后台",
          steps,
          reply: "当前演示单：已提交 → 初审通过 → 待终审。行级权限仅本人可见；状态变更走事务，支持退回重提。",
        },
        { headers: { "X-Request-Id": requestId } },
      );
    }

    steps.push({ role: "fallback", text: "未命中专用工具，返回能力菜单" });
    return NextResponse.json(
      {
        requestId,
        intent: "menu",
        resumeProject: "Atoms Lab 综合演示",
        steps,
        reply:
          "我是简历能力演示机器人。可试：\n1) 「上海三日游」→ TripPal 规划\n2) 「故障码 E42」→ 知识库 RAG\n3) 「查询公司 grkj」→ 填表 Agent\n4) 「档案审批进度」→ 审批后台\n也可点上方 Java / SSE / Planner 模块。",
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
