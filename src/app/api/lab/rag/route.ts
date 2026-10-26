import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { answerFromHits, searchDocs } from "@/lib/lab/bm25";
import { LAB_DOCS } from "@/lib/lab/docs";

const schema = z.object({
  query: z.string().min(1).max(200),
  topK: z.number().int().min(1).max(5).optional(),
});

/** 迷你 RAG：BM25 风格召回 + 空结果禁编造 + 引用标题 */
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const hits = searchDocs(body.query, body.topK ?? 3);
    const { answer, cited } = answerFromHits(body.query, hits);
    return NextResponse.json({
      query: body.query,
      hits: hits.map((h) => ({
        id: h.id,
        title: h.title,
        role: h.role,
        score: Number(h.score.toFixed(3)),
        snippet: h.snippet,
      })),
      answer,
      cited,
      corpusSize: LAB_DOCS.length,
      note: "本地语料演示；生产可换 pgvector + Rerank，保持空结果不编造。",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bad request" },
      { status: 400 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    corpusSize: LAB_DOCS.length,
    docs: LAB_DOCS.map((d) => ({ id: d.id, title: d.title, role: d.role })),
  });
}
