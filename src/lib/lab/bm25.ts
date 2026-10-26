import { LAB_DOCS, type LabDoc } from "./docs";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]+/gi, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** 轻量 BM25 风格打分（演示用，不依赖外部库） */
export function searchDocs(query: string, topK = 3): Array<LabDoc & { score: number; snippet: string }> {
  const qTokens = tokenize(query);
  if (!qTokens.length) return [];

  const docs = LAB_DOCS.map((d) => {
    const corpus = `${d.title} ${d.text}`;
    const tokens = tokenize(corpus);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);

    let score = 0;
    for (const qt of qTokens) {
      const f = tf.get(qt) || 0;
      if (!f) continue;
      // 故障码 / 标题命中加权
      const titleBoost = d.title.toLowerCase().includes(qt) ? 2.2 : 1;
      const codeBoost = /e\d+/i.test(qt) ? 1.8 : 1;
      score += (f / (f + 1.2)) * titleBoost * codeBoost;
    }

    const snippet =
      d.text.length > 90 ? `${d.text.slice(0, 90)}…` : d.text;
    return { ...d, score, snippet };
  })
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return docs;
}

export function answerFromHits(
  query: string,
  hits: Array<LabDoc & { score: number }>,
): { answer: string; cited: string[] } {
  if (!hits.length) {
    return {
      answer:
        "资料不足：当前迷你知识库未命中相关片段，未编造维保/工程结论。请换关键词（如 E42、SSE、软超时）或补充文档后再问。",
      cited: [],
    };
  }

  const cited = hits.map((h) => h.title);
  const bullets = hits.map((h, i) => `（${i + 1}）依据《${h.title}》：${h.text.slice(0, 70)}…`).join("\n");
  return {
    answer: `针对「${query}」，基于召回片段整理如下（可溯源，非模型瞎编）：\n${bullets}\n\n说明：此为本地 BM25 风格混合演示；生产环境可替换为 pgvector + Rerank，并保持空结果禁编造。`,
    cited,
  };
}
