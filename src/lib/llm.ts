import OpenAI from "openai";
import { BUILD_SYSTEM, ITERATE_SYSTEM, PLAN_SYSTEM, extractHtml, extractJsonObject } from "./prompts";
import type { BuildPlan } from "./types";
import { demoBuildHtml, demoIterateHtml, demoPlan } from "./demo";

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
