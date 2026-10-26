"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type RagHit = {
  id: string;
  title: string;
  role: string;
  score: number;
  snippet: string;
};

export default function LabPage() {
  // SSE
  const [sseTopic, setSseTopic] = useState("杭州两日游");
  const [sseLog, setSseLog] = useState("");
  const [sseBusy, setSseBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // RAG
  const [ragQuery, setRagQuery] = useState("故障码 E42 怎么处理");
  const [ragAnswer, setRagAnswer] = useState("");
  const [ragHits, setRagHits] = useState<RagHit[]>([]);
  const [ragBusy, setRagBusy] = useState(false);
  const [corpus, setCorpus] = useState<{ id: string; title: string; role: string }[]>([]);

  // Planner
  const [goal, setGoal] = useState("上海三日亲子游");
  const [delayMs, setDelayMs] = useState(800);
  const [softMs, setSoftMs] = useState(3000);
  const [planOut, setPlanOut] = useState("");
  const [planBusy, setPlanBusy] = useState(false);

  useEffect(() => {
    fetch("/api/lab/rag")
      .then((r) => r.json())
      .then((d) => setCorpus(d.docs || []))
      .catch(() => setCorpus([]));
  }, []);

  const stopSse = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSseBusy(false);
  }, []);

  async function runSse() {
    stopSse();
    setSseLog("");
    setSseBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(`/api/lab/sse?topic=${encodeURIComponent(sseTopic)}`, {
        signal: ac.signal,
        headers: { Accept: "text/event-stream" },
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const block of parts) {
          const lines = block.split("\n");
          let event = "message";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!data) continue;
          try {
            const json = JSON.parse(data) as Record<string, unknown>;
            const line =
              event === "status"
                ? `[status] ${String(json.text || json.phase || "")}`
                : event === "message"
                  ? String(json.text || "")
                  : event === "error"
                    ? `[error] ${String(json.message || "")}`
                    : event === "done"
                      ? `\n[done] cancelled=${String(json.cancelled)} ok=${String(json.ok ?? true)}`
                      : `[${event}] ${data}`;
            setSseLog((prev) => prev + line + (line.endsWith("\n") ? "" : "\n"));
          } catch {
            setSseLog((prev) => prev + data + "\n");
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setSseLog((prev) => prev + `\n[error] ${(e as Error).message}`);
      }
    } finally {
      setSseBusy(false);
      abortRef.current = null;
    }
  }

  async function runRag() {
    setRagBusy(true);
    setRagAnswer("");
    setRagHits([]);
    try {
      const res = await fetch("/api/lab/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: ragQuery, topK: 3 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "请求失败");
      setRagHits(data.hits || []);
      setRagAnswer(data.answer || "");
    } catch (e) {
      setRagAnswer(`错误：${(e as Error).message}`);
    } finally {
      setRagBusy(false);
    }
  }

  async function runPlanner() {
    setPlanBusy(true);
    setPlanOut("");
    try {
      const res = await fetch("/api/lab/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          researchDelayMs: delayMs,
          softTimeoutMs: softMs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "请求失败");
      setPlanOut(JSON.stringify(data, null, 2));
    } catch (e) {
      setPlanOut(`错误：${(e as Error).message}`);
    } finally {
      setPlanBusy(false);
    }
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          Atoms <span>Lab</span>
        </div>
        <div className={styles.navActions}>
          <Link className={styles.btnGhost} href="/">
            首页
          </Link>
          <Link className={styles.btnGhost} href="/studio">
            工坊
          </Link>
          <Link className={styles.btn} href="/register">
            开始构建
          </Link>
        </div>
      </nav>

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>能力实验室 · 简历可演示能力</h1>
          <p className={styles.lead}>
            对应杨晓亮简历中的全栈 / AI 工程化能力：SSE 流式与 Abort 取消、迷你 RAG（空结果禁编造）、
            Research→Planner 两阶段 + 软超时。以下接口无模型 Key 也可完整体验；工坊主流程仍可走真实 LLM（有 Key）或演示模式。
          </p>
          <div className={styles.tags}>
            <span className={styles.tag}>Frontend · SSE 手解析</span>
            <span className={styles.tag}>Backend · Route Handler</span>
            <span className={styles.tag}>AI · 两阶段 Agent</span>
            <span className={styles.tag}>RAG · BM25 风格召回</span>
            <span className={styles.tag}>工程 · 软超时 / 降级</span>
          </div>
        </section>

        <div className={styles.grid}>
          {/* SSE */}
          <section className={styles.card}>
            <h2>
              1. SSE 流式输出
              <span className={styles.badge}>前端 + 后端</span>
            </h2>
            <p className={styles.meta}>
              事件协议 status / message / error / done；fetch 流式读取；可一键 Abort 模拟关页取消（对应 TripPal 断连治理）。
            </p>
            <input
              className={styles.field}
              value={sseTopic}
              onChange={(e) => setSseTopic(e.target.value)}
              placeholder="主题"
            />
            <div className={styles.actions}>
              <button className={styles.primary} type="button" disabled={sseBusy} onClick={runSse}>
                {sseBusy ? "推送中…" : "开始流式"}
              </button>
              <button className={styles.danger} type="button" disabled={!sseBusy} onClick={stopSse}>
                Abort 取消
              </button>
            </div>
            <pre className={styles.out}>{sseLog || "点击开始后，这里会实时追加事件…"}</pre>
          </section>

          {/* RAG */}
          <section className={styles.card}>
            <h2>
              2. 迷你知识库 RAG
              <span className={styles.badge}>AI · 检索</span>
            </h2>
            <p className={styles.meta}>
              本地语料 {corpus.length} 篇；BM25 风格打分 + 引用标题；无命中返回「资料不足」，不编造结论。
            </p>
            <textarea
              className={styles.fieldArea}
              value={ragQuery}
              onChange={(e) => setRagQuery(e.target.value)}
            />
            <div className={styles.actions}>
              <button className={styles.primary} type="button" disabled={ragBusy} onClick={runRag}>
                {ragBusy ? "检索中…" : "检索并回答"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRagQuery("SSE 为什么要 Abort");
                }}
              >
                试：SSE Abort
              </button>
              <button
                type="button"
                onClick={() => {
                  setRagQuery("火星发动机说明书");
                }}
              >
                试：空结果
              </button>
            </div>
            <pre className={styles.out}>{ragAnswer || "检索结果与可溯源回答将显示在这里…"}</pre>
            {ragHits.map((h) => (
              <div key={h.id} className={styles.hit}>
                <strong>{h.score.toFixed(2)}</strong> · {h.title}（{h.role}）
                <div>{h.snippet}</div>
              </div>
            ))}
          </section>

          {/* Planner */}
          <section className={`${styles.card} ${styles.wide}`}>
            <h2>
              3. Research→Planner 两阶段 + 软超时
              <span className={styles.badge}>AI · Agent</span>
            </h2>
            <p className={styles.meta}>
              调节「检索耗时」与「软超时」：当检索超过软超时，跳过 Research 仍继续 Planner（对应 TripPal Tavily ≈3s 软超时口径）。
            </p>
            <div className={styles.row}>
              <input
                className={styles.field}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="规划目标"
              />
            </div>
            <div className={styles.row}>
              <label className={styles.sliderLabel}>
                模拟检索耗时 {delayMs}ms
                <input
                  className={styles.field}
                  type="range"
                  min={0}
                  max={5000}
                  step={100}
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value))}
                />
              </label>
              <label className={styles.sliderLabel}>
                软超时 {softMs}ms
                <input
                  className={styles.field}
                  type="range"
                  min={500}
                  max={4000}
                  step={100}
                  value={softMs}
                  onChange={(e) => setSoftMs(Number(e.target.value))}
                />
              </label>
            </div>
            <div className={styles.actions}>
              <button className={styles.primary} type="button" disabled={planBusy} onClick={runPlanner}>
                {planBusy ? "编排中…" : "运行两阶段"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDelayMs(4000);
                  setSoftMs(1000);
                }}
              >
                预设：触发软超时
              </button>
              <button
                type="button"
                onClick={() => {
                  setDelayMs(600);
                  setSoftMs(3000);
                }}
              >
                预设：检索成功
              </button>
            </div>
            <pre className={styles.out}>{planOut || "运行后展示 Research / Planner JSON…"}</pre>
          </section>
        </div>

        <p className={styles.footer}>
          主产品入口仍是首页「一句话生成网页」工坊（多智能体 Emma/Mike/Alex、版本、分享、无 Key 演示模式）。
          本页 Lab 用于面试现场快速演示工程能力，不依赖外部模型 Key。
          源码：<code>/lab</code>、<code>/api/lab/*</code>
        </p>
      </main>
    </div>
  );
}
