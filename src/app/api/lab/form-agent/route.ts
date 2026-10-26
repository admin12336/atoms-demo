import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { newRequestId } from "@/lib/requestId";

/**
 * 迷你「槽位 + 工具」业务 Agent 演示（对应简历「参与」口径，非完整 LangGraph）
 * 工具：lookupCompany — 本地 mock，不打外网
 */

const schema = z.object({
  message: z.string().min(1).max(200),
  slots: z
    .object({
      companyName: z.string().optional(),
      creditCode: z.string().optional(),
      contact: z.string().optional(),
    })
    .optional(),
});

type Slots = { companyName?: string; creditCode?: string; contact?: string };

const MOCK_DB: Record<string, { creditCode: string; contact: string }> = {
  grkj: { creditCode: "91110000GRKJ00001X", contact: "张工 010-8888-0001" },
  深度赋智: { creditCode: "91110000SDFZ00002Y", contact: "李工 010-6666-0002" },
};

function lookupCompany(name: string) {
  const key = Object.keys(MOCK_DB).find((k) => name.includes(k) || k.includes(name));
  if (!key) return null;
  return { name: key, ...MOCK_DB[key] };
}

function extractCompany(message: string): string | undefined {
  const m = message.match(/(?:公司|企业|查询)\s*[「":：]?\s*([\u4e00-\u9fa5A-Za-z0-9]{2,20})/);
  if (m) return m[1];
  if (message.toLowerCase().includes("grkj")) return "grkj";
  return undefined;
}

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const rl = rateLimit(`lab-form:${clientKey(req)}`, 40);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "限流", requestId, retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "X-Request-Id": requestId, "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  try {
    const body = schema.parse(await req.json());
    const slots: Slots = { ...(body.slots || {}) };
    const trace: Array<{ step: string; detail: string }> = [];

    const company = slots.companyName || extractCompany(body.message);
    if (company) {
      slots.companyName = company;
      trace.push({ step: "slot_fill", detail: `写入 companyName=${company}` });
    }

    let toolResult: ReturnType<typeof lookupCompany> = null;
    if (slots.companyName && (!slots.creditCode || !slots.contact)) {
      trace.push({ step: "tool_call", detail: `lookupCompany("${slots.companyName}")` });
      toolResult = lookupCompany(slots.companyName);
      if (toolResult) {
        slots.creditCode = toolResult.creditCode;
        slots.contact = toolResult.contact;
        slots.companyName = toolResult.name;
        trace.push({ step: "tool_ok", detail: "回填 creditCode / contact" });
      } else {
        trace.push({ step: "tool_miss", detail: "未命中 mock 库，保留已填槽位，不推倒重来" });
      }
    }

    const missing = (["companyName", "creditCode", "contact"] as const).filter((k) => !slots[k]);
    const done = missing.length === 0;

    return NextResponse.json(
      {
        requestId,
        slots,
        missing,
        done,
        reply: done
          ? `表单已填齐：${slots.companyName} / ${slots.creditCode} / ${slots.contact}。可人工二次编辑后提交。`
          : missing.includes("companyName")
            ? "请告诉我公司名称，例如：查询公司 grkj。"
            : `已部分回填；仍缺：${missing.join("、")}。可再说一次公司名触发工具。`,
        trace,
        note: "受约束槽位机 + 单工具；Mock 数据。生产可换真政务接口，开关与演示隔离。",
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
