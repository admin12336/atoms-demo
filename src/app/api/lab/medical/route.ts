import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { newRequestId } from "@/lib/requestId";
import { isBlockedMedicalQuery, MEDICAL_DOCS, searchMedical } from "@/lib/lab/medical";

/**
 * 医疗科普对话机器人演示（对齐简历项目）
 * 技术栈展示：FastAPI 风格契约、LangChain/LangGraph 步骤、LiteLLM 路由、
 * pgvector+Milvus 双库、Redis Memory、SSE 可选、Function Calling、Playwright 增量
 * 宿主为 Next.js，无真实 JVM/Milvus 集群；逻辑可答辩。
 */

const schema = z.object({
  action: z.enum(["chat", "crawl", "models", "health"]).default("chat"),
  message: z.string().max(300).optional(),
  sessionId: z.string().max(64).optional(),
  model: z.enum(["qwen-private", "deepseek-private", "openai-compat"]).optional(),
});

/** 进程内模拟 Redis 会话 Memory（Vercel 无状态时按请求演示） */
const memory = new Map<string, Array<{ role: string; text: string }>>();

function fastapiOk(data: unknown, requestId: string, latencyMs: number) {
  return NextResponse.json(
    {
      code: 0,
      message: "ok",
      data,
      requestId,
      latencyMs,
      style: "FastAPI Response envelope (demo)",
    },
    { headers: { "X-Request-Id": requestId } },
  );
}

export async function GET() {
  const requestId = newRequestId();
  return fastapiOk(
    {
      project: "医疗科普对话咨询机器人",
      stack: [
        "Python",
        "FastAPI",
        "LangChain",
        "LangGraph",
        "LiteLLM",
        "PostgreSQL(pgvector)",
        "Milvus",
        "Redis",
        "SSE",
        "Function-Calling",
        "Playwright",
      ],
      corpusSize: MEDICAL_DOCS.length,
      note: "仅科普/导诊/宣教答疑，不提供诊断与开药",
    },
    requestId,
    0,
  );
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const requestId = newRequestId();
  const rl = rateLimit(`lab-medical:${clientKey(req)}`, 40);
  if (!rl.ok) {
    return NextResponse.json(
      { code: 429, message: "限流", data: null, requestId },
      { status: 429, headers: { "X-Request-Id": requestId } },
    );
  }

  try {
    const body = schema.parse(await req.json().catch(() => ({ action: "chat" })));
    const latency = () => Date.now() - started;

    if (body.action === "health") {
      return fastapiOk(
        {
          status: "UP",
          checks: {
            fastapi: "UP",
            redis_memory: "UP(mock)",
            pgvector: "UP(mock)",
            milvus: "UP(mock)",
            litellm_router: "UP",
          },
        },
        requestId,
        latency(),
      );
    }

    if (body.action === "models") {
      return fastapiOk(
        {
          litellm: true,
          routes: [
            { id: "qwen-private", vendor: "通义私有化", weight: 0.5 },
            { id: "deepseek-private", vendor: "DeepSeek 私有化", weight: 0.3 },
            { id: "openai-compat", vendor: "OpenAI 兼容网关", weight: 0.2 },
          ],
          selected: body.model || "qwen-private",
        },
        requestId,
        latency(),
      );
    }

    if (body.action === "crawl") {
      // Playwright 增量采集演示（无真实爬取，返回可答辩结构）
      return fastapiOk(
        {
          tool: "Playwright",
          source: "院内公开宣教站点（演示）",
          steps: [
            { role: "browser", text: "启动无头浏览器，打开宣教栏目" },
            { role: "scrape", text: "提取 PDF / Markdown 宣教链接" },
            { role: "pipeline", text: "解析 → Chunking → Embedding → 写入 pgvector / Milvus" },
          ],
          ingested: [
            { title: "高血压健康科普手册", chunks: 4 },
            { title: "糖尿病宣教问答", chunks: 3 },
          ],
          incremental: true,
        },
        requestId,
        latency(),
      );
    }

    // chat
    const msg = (body.message || "").trim();
    if (!msg) {
      return NextResponse.json(
        { code: 400, message: "message required", data: null, requestId },
        { status: 400, headers: { "X-Request-Id": requestId } },
      );
    }

    const sessionId = body.sessionId || "demo-session";
    const history = memory.get(sessionId) || [];
    history.push({ role: "user", text: msg });

    const graphSteps: Array<{ role: string; text: string }> = [
      { role: "langgraph", text: "StateGraph：router → compliance → retrieve → answer" },
      { role: "compliance", text: "合规节点：检测诊断/开药等高风险意图" },
    ];

    if (isBlockedMedicalQuery(msg)) {
      const reply =
        "合规拦截：我仅提供健康科普、导诊引导与宣教资料答疑，不能进行诊断、开药或给出治疗方案。请前往医院由专业医护人员评估。";
      history.push({ role: "assistant", text: reply });
      memory.set(sessionId, history.slice(-8));
      graphSteps.push({ role: "block", text: "命中禁答策略，短路返回" });
      return fastapiOk(
        {
          intent: "blocked",
          resumeProject: "医疗科普对话咨询机器人",
          model: body.model || "qwen-private",
          litellmRouted: true,
          reply,
          steps: graphSteps,
          memoryTurns: history.length,
          vector: null,
        },
        requestId,
        latency(),
      );
    }

    graphSteps.push({ role: "tool", text: "Function-Calling：retrieve_medical_kb(query)" });
    const hits = searchMedical(msg, 3);
    graphSteps.push({
      role: "retrieve",
      text: hits.length
        ? `双库检索：pgvector topHits=${hits.length}；Milvus 重排对齐（演示）`
        : "双库未命中，返回资料不足（不编造）",
    });

    const model = body.model || "qwen-private";
    graphSteps.push({ role: "litellm", text: `LiteLLM 路由至 ${model}` });

    let reply: string;
    if (!hits.length) {
      reply =
        "资料不足：当前科普知识库未命中相关宣教片段，未编造医疗结论。可换「高血压科普 / 导诊 / 糖尿病宣教」等关键词，或触发 Playwright 增量采集。";
    } else {
      const cited = hits.map((h) => h.title).join("；");
      reply = `【科普答疑·非诊疗】依据院内宣教资料整理：${hits[0].text}\n\n引用：${cited}`;
      graphSteps.push({ role: "rerank", text: "Rerank 提升宣教手册命中优先级" });
    }

    history.push({ role: "assistant", text: reply });
    memory.set(sessionId, history.slice(-8));

    return fastapiOk(
      {
        intent: hits.length ? "medical_rag" : "medical_empty",
        resumeProject: "医疗科普对话咨询机器人",
        model,
        litellmRouted: true,
        reply,
        steps: graphSteps,
        memoryTurns: history.length,
        redisMemory: "mock-hit",
        vector: {
          pgvector: hits.map((h) => ({ id: h.id, score: h.score, title: h.title })),
          milvus: hits.map((h, i) => ({ id: h.id, score: Number((h.score * 0.92 - i * 0.01).toFixed(3)) })),
        },
        cited: hits.map((h) => h.title),
        suggestions: ["高血压饮食科普", "门诊怎么走", "我是不是得了糖尿病要开药吗", "术后注意事项"],
      },
      requestId,
      latency(),
    );
  } catch (e) {
    return NextResponse.json(
      {
        code: 400,
        message: e instanceof Error ? e.message : "bad request",
        data: null,
        requestId,
      },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }
}
