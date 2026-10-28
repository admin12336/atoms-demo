"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LAB_DOCS } from "@/lib/lab/docs";
import styles from "./page.module.css";

type RagHit = {
  id: string;
  title: string;
  role: string;
  score: number;
  snippet: string;
};

type ResearchMode = "mock_whitelist" | "live_research";

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
  const [corpus, setCorpus] = useState(() =>
    LAB_DOCS.map((d) => ({ id: d.id, title: d.title, role: d.role })),
  );

  // Planner
  const [goal, setGoal] = useState("上海三日亲子游");
  const [delayMs, setDelayMs] = useState(800);
  const [softMs, setSoftMs] = useState(3000);
  const [researchMode, setResearchMode] = useState<ResearchMode>("live_research");
  const [injectJump, setInjectJump] = useState(false);
  const [planOut, setPlanOut] = useState("");
  const [planBusy, setPlanBusy] = useState(false);

  // Form agent
  const [formMsg, setFormMsg] = useState("查询公司 grkj");
  const [formOut, setFormOut] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [formSlots, setFormSlots] = useState<Record<string, string>>({});

  // Java 契约
  const [javaOut, setJavaOut] = useState("");
  const [javaBusy, setJavaBusy] = useState(false);

  // 业务机器人
  const [botMsg, setBotMsg] = useState("故障码 E42 怎么处理");
  const [botOut, setBotOut] = useState("");
  const [botBusy, setBotBusy] = useState(false);

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
      // POST + JSON Body：演示非 EventSource 可带鉴权/Body
      const res = await fetch("/api/lab/sse", {
        method: "POST",
        signal: ac.signal,
        headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
        body: JSON.stringify({ topic: sseTopic }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const rid = res.headers.get("X-Request-Id");
      if (rid) setSseLog((p) => p + `[header] X-Request-Id=${rid}\n`);
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
                      ? `\n[done] cancelled=${String(json.cancelled)} ok=${String(json.ok ?? true)} mode=${String(json.llmMode ?? "")}`
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
      setRagAnswer(`${data.answer || ""}\n\nrequestId=${data.requestId || res.headers.get("X-Request-Id")}`);
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
          researchMode,
          injectGeoJump: injectJump,
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

  async function runFormAgent() {
    setFormBusy(true);
    setFormOut("");
    try {
      const res = await fetch("/api/lab/form-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: formMsg, slots: formSlots }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "请求失败");
      setFormSlots(data.slots || {});
      setFormOut(JSON.stringify(data, null, 2));
    } catch (e) {
      setFormOut(`错误：${(e as Error).message}`);
    } finally {
      setFormBusy(false);
    }
  }

  async function runJava(action: "echo" | "park_metrics" | "health") {
    setJavaBusy(true);
    setJavaOut("");
    try {
      const res = await fetch("/api/lab/java", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, keyword: "spring-boot" }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 429) throw new Error(data.message || data.error || "请求失败");
      setJavaOut(JSON.stringify(data, null, 2));
    } catch (e) {
      setJavaOut(`错误：${(e as Error).message}`);
    } finally {
      setJavaBusy(false);
    }
  }

  async function runBot() {
    setBotBusy(true);
    setBotOut("");
    try {
      const res = await fetch("/api/lab/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: botMsg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "请求失败");
      setBotOut(JSON.stringify(data, null, 2));
    } catch (e) {
      setBotOut(`错误：${(e as Error).message}`);
    } finally {
      setBotBusy(false);
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
          <h1>能力实验室 · 简历项目一页演示</h1>
          <p className={styles.lead}>
            对齐简历：Java 接口契约、前后端联调、业务机器人、AI（SSE / RAG / 两阶段 / 填表）、驾驶舱指标、审批问答。
            打开 <code>/grkj</code> 即可体验，无需 Key。
          </p>
          <div className={styles.tags}>
            <span className={styles.tag}>Java 契约</span>
            <span className={styles.tag}>前端 · React</span>
            <span className={styles.tag}>后端 · API</span>
            <span className={styles.tag}>业务机器人</span>
            <span className={styles.tag}>AI · SSE/RAG/Agent</span>
          </div>
        </section>

        <div className={styles.grid}>
          <section className={styles.card}>
            <h2>
              1. SSE 流式（POST）
              <span className={styles.badge}>前端 + 后端</span>
            </h2>
            <p className={styles.meta}>
              fetch + ReadableStream；JSON Body（非 EventSource）；Abort 取消；响应头 X-Request-Id。有 Key 真流 / 无 Key 假流。
            </p>
            <input
              className={styles.field}
              value={sseTopic}
              onChange={(e) => setSseTopic(e.target.value)}
              placeholder="主题"
            />
            <div className={styles.actions}>
              <button className={styles.primary} type="button" disabled={sseBusy} onClick={runSse}>
                {sseBusy ? "推送中…" : "POST 开始流式"}
              </button>
              <button className={styles.danger} type="button" disabled={!sseBusy} onClick={stopSse}>
                Abort 取消
              </button>
            </div>
            <pre className={styles.out}>{sseLog || "点击开始后，这里会实时追加事件…"}</pre>
          </section>

          <section className={styles.card}>
            <h2>
              2. 迷你知识库 RAG
              <span className={styles.badge}>AI · 检索</span>
            </h2>
            <p className={styles.meta}>
              本地语料 {corpus.length} 篇；BM25 风格打分 + 引用；无命中「资料不足」，不编造。
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
              <button type="button" onClick={() => setRagQuery("SSE 为什么要 Abort")}>
                试：SSE Abort
              </button>
              <button type="button" onClick={() => setRagQuery("火星发动机说明书")}>
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

          <section className={`${styles.card} ${styles.wide}`}>
            <h2>
              3. Research→Planner · Mock / 软超时分离
              <span className={styles.badge}>AI · Agent</span>
            </h2>
            <p className={styles.meta}>
              <b>mock_whitelist</b>：预制摘要，不跑超时竞态；<b>live_research</b>：模拟检索 + 软超时跳过（生产降级）。二者隔离。可注入跳点脏数据走 ContractGuard。
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
                检索模式
                <select
                  className={styles.field}
                  value={researchMode}
                  onChange={(e) => setResearchMode(e.target.value as ResearchMode)}
                >
                  <option value="live_research">live_research（软超时降级）</option>
                  <option value="mock_whitelist">mock_whitelist（白名单演示）</option>
                </select>
              </label>
              <label className={styles.sliderLabel}>
                <input type="checkbox" checked={injectJump} onChange={(e) => setInjectJump(e.target.checked)} />{" "}
                注入跨城跳点脏数据
              </label>
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
                  disabled={researchMode === "mock_whitelist"}
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
                  disabled={researchMode === "mock_whitelist"}
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
                  setResearchMode("live_research");
                  setDelayMs(4000);
                  setSoftMs(1000);
                  setInjectJump(false);
                }}
              >
                预设：软超时
              </button>
              <button
                type="button"
                onClick={() => {
                  setResearchMode("mock_whitelist");
                  setInjectJump(true);
                }}
              >
                预设：Mock + 跳点校验
              </button>
            </div>
            <pre className={styles.out}>{planOut || "运行后展示 Research / Planner / Contract JSON…"}</pre>
          </section>

          <section className={`${styles.card} ${styles.wide}`}>
            <h2>
              4. 槽位 + 工具填表 Agent
              <span className={styles.badge}>AI · 业务 Agent</span>
            </h2>
            <p className={styles.meta}>
              受约束槽位机；工具 lookupCompany（本地 mock，试「查询公司 grkj」）。参与口径演示，非完整 LangGraph。
            </p>
            <input
              className={styles.field}
              value={formMsg}
              onChange={(e) => setFormMsg(e.target.value)}
              placeholder="用户话术"
            />
            <div className={styles.actions}>
              <button className={styles.primary} type="button" disabled={formBusy} onClick={runFormAgent}>
                {formBusy ? "执行中…" : "跑一轮"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormMsg("查询公司 grkj");
                  setFormSlots({});
                }}
              >
                重置试 grkj
              </button>
            </div>
            <pre className={styles.out}>{formOut || "槽位 / 工具 trace 将显示在这里…"}</pre>
          </section>

          <section className={styles.card}>
            <h2>
              5. Java 风格后端契约
              <span className={styles.badge}>Java · 后端</span>
            </h2>
            <p className={styles.meta}>
              统一返回 code / message / data / requestId（Spring Boot Result 风格）；含健康检查与驾驶舱指标接口。
            </p>
            <div className={styles.actions}>
              <button className={styles.primary} type="button" disabled={javaBusy} onClick={() => runJava("echo")}>
                {javaBusy ? "请求中…" : "Echo 契约"}
              </button>
              <button type="button" disabled={javaBusy} onClick={() => runJava("park_metrics")}>
                驾驶舱指标
              </button>
              <button type="button" disabled={javaBusy} onClick={() => runJava("health")}>
                Health
              </button>
            </div>
            <pre className={styles.out}>{javaOut || "点击按钮查看 Java 风格 JSON…"}</pre>
          </section>

          <section className={styles.card}>
            <h2>
              6. 业务机器人
              <span className={styles.badge}>机器人 · AI</span>
            </h2>
            <p className={styles.meta}>
              一路由多工具：行程规划 / 知识库 / 填表 / 审批。对应 TripPal、RAG、表单 Agent、档案审批等简历项目。
            </p>
            <input
              className={styles.field}
              value={botMsg}
              onChange={(e) => setBotMsg(e.target.value)}
              placeholder="对机器人说一句话"
            />
            <div className={styles.actions}>
              <button className={styles.primary} type="button" disabled={botBusy} onClick={runBot}>
                {botBusy ? "思考中…" : "发送"}
              </button>
              <button type="button" onClick={() => setBotMsg("上海三日游")}>
                行程
              </button>
              <button type="button" onClick={() => setBotMsg("档案审批进度")}>
                审批
              </button>
            </div>
            <pre className={styles.out}>{botOut || "机器人回复将显示在这里…"}</pre>
          </section>
        </div>

        <p className={styles.footer}>
          简历项目映射：TripPal→Planner/SSE；知识库+H5→RAG；表单 Agent→填表；驾驶舱→Java 指标；审批后台→机器人审批。
          工坊入口仍可生成网页。源码：<code>/lab</code>、<code>/api/lab/*</code>
        </p>
      </main>
    </div>
  );
}
