import OpenAI from "openai";
import { BUILD_SYSTEM, ITERATE_SYSTEM, PLAN_SYSTEM, extractHtml, extractJsonObject } from "./prompts";
import type { BuildPlan } from "./types";
import { demoBuildHtml, demoIterateHtml, demoPlan } from "./demo";
import { sleep } from "./sse";

function hasApiKey() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "sk-your-key");
}

function client() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1",
  });
}

function model() {
  return process.env.OPENAI_MODEL || "deepseek-chat";
}

export function llmMode(): "live" | "demo" {
  if (hasApiKey()) return "live";
  if (process.env.ALLOW_DEMO_MODE !== "false") return "demo";
  throw new Error("未配置 OPENAI_API_KEY，且未开启演示模式");
}

export async function runPlan(userIdea: string, weatherHint?: string): Promise<BuildPlan> {
  if (llmMode() === "demo") return demoPlan(userIdea);

  const completion = await client().chat.completions.create({
    model: model(),
    temperature: 0.4,
    messages: [
      { role: "system", content: PLAN_SYSTEM },
      {
        role: "user",
        content: weatherHint
          ? `用户需求：${userIdea}\n\n可选上下文（今日天气，可在方案中酌情融入）：${weatherHint}`
          : `用户需求：${userIdea}`,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? "";
  return extractJsonObject(text) as BuildPlan;
}

export async function runBuild(plan: BuildPlan, weatherHint?: string): Promise<string> {
  if (llmMode() === "demo") return demoBuildHtml(plan);

  const completion = await client().chat.completions.create({
    model: model(),
    temperature: 0.35,
    messages: [
      { role: "system", content: BUILD_SYSTEM },
      {
        role: "user",
        content:
          `请根据以下方案生成完整 HTML：\n${JSON.stringify(plan, null, 2)}` +
          (weatherHint ? `\n\n若适合，可在界面展示天气信息：${weatherHint}` : ""),
      },
    ],
  });

  return extractHtml(completion.choices[0]?.message?.content ?? "");
}

export async function runIterate(html: string, instruction: string): Promise<string> {
  if (llmMode() === "demo") return demoIterateHtml(html, instruction);

  const completion = await client().chat.completions.create({
    model: model(),
    temperature: 0.3,
    messages: [
      { role: "system", content: ITERATE_SYSTEM },
      {
        role: "user",
        content: `修改要求：${instruction}\n\n当前 HTML：\n${html.slice(0, 120000)}`,
      },
    ],
  });

  return extractHtml(completion.choices[0]?.message?.content ?? "");
}

type StreamOpts = {
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
};

async function streamChat(
  system: string,
  user: string,
  temperature: number,
  opts?: StreamOpts,
): Promise<string> {
  const stream = await client().chat.completions.create({
    model: model(),
    temperature,
    stream: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  let full = "";
  for await (const chunk of stream) {
    if (opts?.signal?.aborted) {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    }
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (!delta) continue;
    full += delta;
    opts?.onDelta?.(delta);
  }
  return full;
}

/** 演示模式假流式：按块推送，支持 Abort */
async function fakeStreamText(text: string, opts?: StreamOpts): Promise<string> {
  const size = Math.max(24, Math.ceil(text.length / 28));
  let out = "";
  for (let i = 0; i < text.length; i += size) {
    if (opts?.signal?.aborted) {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    }
    const piece = text.slice(i, i + size);
    out += piece;
    opts?.onDelta?.(piece);
    await sleep(40, opts?.signal);
  }
  return out;
}

export async function runBuildStreaming(
  plan: BuildPlan,
  weatherHint: string | undefined,
  opts?: StreamOpts,
): Promise<string> {
  if (llmMode() === "demo") {
    const html = demoBuildHtml(plan);
    await fakeStreamText(html, opts);
    return html;
  }
  const user =
    `请根据以下方案生成完整 HTML：\n${JSON.stringify(plan, null, 2)}` +
    (weatherHint ? `\n\n若适合，可在界面展示天气信息：${weatherHint}` : "");
  const raw = await streamChat(BUILD_SYSTEM, user, 0.35, opts);
  return extractHtml(raw);
}

export async function runIterateStreaming(
  html: string,
  instruction: string,
  opts?: StreamOpts,
): Promise<string> {
  if (llmMode() === "demo") {
    const next = demoIterateHtml(html, instruction);
    await fakeStreamText(next, opts);
    return next;
  }
  const user = `修改要求：${instruction}\n\n当前 HTML：\n${html.slice(0, 120000)}`;
  const raw = await streamChat(ITERATE_SYSTEM, user, 0.3, opts);
  return extractHtml(raw);
}

/** Lab SSE：有 Key 则真流式短文，否则假流 */
export async function streamLabNarrative(topic: string, opts?: StreamOpts): Promise<string> {
  if (llmMode() === "demo") {
    const text =
      `## ${topic}（演示流式）\n` +
      "Day1 上午：核心景点 A（可渲染实体）\n" +
      "Day1 下午：街区漫步 B\n" +
      "说明：demo 模式假流；协议与 TripPal SSE 一致。有 Key 时走真实模型流。\n";
    await fakeStreamText(text, opts);
    return text;
  }
  const system =
    "你是行程规划助手。用中文输出简短可渲染行程骨架（2～4 行），不要 markdown 围栏外的解释。声明非实时票价以现场为准。";
  return streamChat(system, `主题：${topic}`, 0.4, opts);
}
