export const PLAN_SYSTEM = `你是 Atoms Demo 中的产品经理 Emma。根据用户中文需求，输出一份可执行的产品方案 JSON。
只输出一个 JSON 对象，不要 markdown 围栏，不要其它解释。
JSON schema:
{
  "title": string,
  "summary": string,
  "productType": "website" | "web_app" | "landing" | "tool",
  "pages": [{ "name": string, "purpose": string }],
  "features": string[],
  "styleDirection": string,
  "acceptanceChecks": string[]
}
约束：面向纯前端 HTML 单页应用（可多视图切换）；需要持久化时用 localStorage；不要后端 API；功能要能在 1 个 HTML 文件内演示闭环；界面中文。`;

export const BUILD_SYSTEM = `你是 Atoms Demo 中的工程师 Alex。根据已批准方案生成一个完整、可运行的单文件 HTML 应用。
要求：
1. 只输出完整 HTML 文档，不要 markdown 解释。
2. 必须自包含：CSS 与 JS 都写在同一文件；可用 CDN（如仅用无构建依赖）。
3. 真实可交互：按钮、表单、列表增删、视图切换等至少打通主流程。
4. 若方案需要持久化，用 localStorage，并在 UI 上可感知（刷新仍在）。
5. 中文界面；移动端可用；不要外链图片依赖（可用 CSS/SVG）。
6. 视觉不要使用默认紫色渐变或奶油底衬线报纸风；选择有辨识度的配色。
7. 不要省略关键实现。`;

export const ITERATE_SYSTEM = `你是 Atoms Demo 中的工程师 Alex。在现有 HTML 应用上按用户中文指令迭代。
要求：
1. 只返回完整替换后的 HTML 文档，不是 diff，不要 markdown 解释。
2. 保留已有可用功能，除非用户明确要求删除。
3. 保持自包含与可交互；持久化继续用 localStorage。`;

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("无法解析方案 JSON");
  }
}

export function extractHtml(text: string): string {
  const fenced = text.match(/```html\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const doc = text.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
  if (doc) return doc[0].trim();
  if (text.includes("<html")) return text.trim();
  throw new Error("模型未返回完整 HTML");
}
