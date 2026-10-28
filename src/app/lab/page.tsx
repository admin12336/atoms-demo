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

type BotMsg = {
  role: "user" | "bot";
  text: string;
  intent?: string;
  resumeProject?: string;
  latencyMs?: number;
  steps?: Array<{ role: string; text: string }>;
  cited?: string[];
};

type JavaMetric = { name: string; value: number; unit: string; trend?: string };

type FormSlots = Record<string, string>;

const MAP = [
  { href: "#bot", title: "业务机器人", desc: "一路由：行程 / RAG / 填表 / 审批" },
  { href: "#java", title: "Java 后端契约", desc: "Result 风格 + 驾驶舱指标 + Health" },
  { href: "#sse", title: "前端 · 后端 SSE", desc: "POST Body 流式 + Abort + requestId" },
  { href: "#rag", title: "AI 知识库 RAG", desc: "BM25 召回、引用、空结果不编造" },
  { href: "#planner", title: "两阶段 Agent", desc: "Mock ≠ 软超时；地理契约清洗" },
  { href: "#form", title: "填表 Agent", desc: "槽位机 + lookupCompany 工具" },
] as const;

export default function LabPage() {
  const [sseTopic, setSseTopic] = useState("杭州两日游");
  const [sseLog, setSseLog] = useState("");
  const [sseBusy, setSseBusy] = useState(false);
  const [sseDone, setSseDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const [ragQuery, setRagQuery] = useState("故障码 E42 怎么处理");
  const [ragAnswer, setRagAnswer] = useState("");
  const [ragHits, setRagHits] = useState<RagHit[]>([]);
  const [ragBusy, setRagBusy] = useState(false);
  const [ragDone, setRagDone] = useState(false);
  const [corpus, setCorpus] = useState(() =>
    LAB_DOCS.map((d) => ({ id: d.id, title: d.title, role: d.role })),
  );

  const [goal, setGoal] = useState("上海三日亲子游");
  const [delayMs, setDelayMs] = useState(800);
  const [softMs, setSoftMs] = useState(3000);
  const [researchMode, setResearchMode] = useState<ResearchMode>("live_research");
  const [injectJump, setInjectJump] = useState(false);
  const [planOut, setPlanOut] = useState("");
  const [planSummary, setPlanSummary] = useState<string[]>([]);
  const [planBusy, setPlanBusy] = useState(false);
  const [planDone, setPlanDone] = useState(false);

  const [formMsg, setFormMsg] = useState("查询公司 grkj");
  const [formOut, setFormOut] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [formDone, setFormDone] = useState(false);
  const [formSlots, setFormSlots] = useState<FormSlots>({});

  const [javaOut, setJavaOut] = useState("");
  const [javaBusy, setJavaBusy] = useState(false);
  const [javaDone, setJavaDone] = useState(false);
  const [javaMetrics, setJavaMetrics] = useState<JavaMetric[]>([]);
  const [javaLatency, setJavaLatency] = useState<number | null>(null);

  const [botMsg, setBotMsg] = useState("故障码 E42 怎么处理");
  const [botBusy, setBotBusy] = useState(false);
  const [botDone, setBotDone] = useState(false);
  const [botChat, setBotChat] = useState<BotMsg[]>([]);
  const [botSuggestions, setBotSuggestions] = useState([
    "上海三日游",
    "故障码 E42",
    "查询公司 grkj",
    "档案审批进度",
  ]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/lab/rag")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.docs) && d.docs.length) setCorpus(d.docs);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [botChat, botBusy]);

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
      setSseDone(true);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setSseLog((prev) => prev + `\n[error] ${(e as Error).message}`);
      }
    } finally {
      setSseBusy(false);
      abortRef.current = null;
    }
  }

  async function runRag(q?: string) {
    const query = q ?? ragQuery;
    if (q) setRagQuery(q);
    setRagBusy(true);
    setRagAnswer("");
    setRagHits([]);
    try {
      const res = await fetch("/api/lab/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, topK: 3 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "请求失败");
      setRagHits(data.hits || []);
      setRagAnswer(`${data.answer || ""}\n\nrequestId=${data.requestId || res.headers.get("X-Request-Id")}`);
      setRagDone(true);
    } catch (e) {
      setRagAnswer(`错误：${(e as Error).message}`);
    } finally {
      setRagBusy(false);
    }
  }

  async function runPlanner() {
    setPlanBusy(true);
    setPlanOut("");
    setPlanSummary([]);
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
      const research = data.research || {};
      const plan = data.plan || {};
      const summary = [
        `mode=${data.researchMode || researchMode}`,
        research.ok === false ? "软超时跳过检索" : "检索完成",
        injectJump ? "已注入跳点脏数据" : "未注入跳点",
        plan.contractGuard ? "已走契约清洗" : "结构化行程已产出",
        data.requestId ? `rid=${String(data.requestId).slice(0, 8)}` : "",
      ].filter(Boolean);
      setPlanSummary(summary);
      setPlanDone(true);
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
      setFormDone(true);
    } catch (e) {
      setFormOut(`错误：${(e as Error).message}`);
    } finally {
      setFormBusy(false);
    }
  }

  async function runJava(action: "echo" | "park_metrics" | "health") {
    setJavaBusy(true);
    setJavaOut("");
    setJavaMetrics([]);
    setJavaLatency(null);
    try {
      const res = await fetch("/api/lab/java", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, keyword: "spring-boot" }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 429) throw new Error(data.message || data.error || "请求失败");
      setJavaOut(JSON.stringify(data, null, 2));
      setJavaLatency(typeof data.latencyMs === "number" ? data.latencyMs : null);
      if (action === "park_metrics" && Array.isArray(data?.data?.metrics)) {
        setJavaMetrics(data.data.metrics);
      }
      setJavaDone(true);
    } catch (e) {
      setJavaOut(`错误：${(e as Error).message}`);
    } finally {
      setJavaBusy(false);
    }
  }

  async function runBot(message?: string) {
    const msg = (message ?? botMsg).trim();
    if (!msg) return;
    if (message) setBotMsg(message);
    setBotBusy(true);
    setBotChat((prev) => [...prev, { role: "user", text: msg }]);
    try {
      const res = await fetch("/api/lab/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "请求失败");
      setBotChat((prev) => [
        ...prev,
        {
          role: "bot",
          text: data.reply || JSON.stringify(data, null, 2),
          intent: data.intent,
          resumeProject: data.resumeProject,
          latencyMs: data.latencyMs,
          steps: data.steps,
          cited: data.cited,
        },
      ]);
      if (Array.isArray(data.suggestions) && data.suggestions.length) {
        setBotSuggestions(data.suggestions);
      }
      if (data.slots) setFormSlots((s) => ({ ...s, ...data.slots }));
      setBotDone(true);
    } catch (e) {
      setBotChat((prev) => [...prev, { role: "bot", text: `错误：${(e as Error).message}` }]);
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
          <h1>能力实验室 · 简历项目可演示版</h1>
          <p className={styles.lead}>
            同一链接 <code>/grkj</code> 打开本页。按面试叙事组织：先综合机器人，再 Java
            契约与驾驶舱，再 SSE / RAG / 两阶段 / 填表深潜。无 Key 可完整体验。
          </p>
          <p className={styles.note}>
            口径说明：本 Demo 宿主为 Next.js；Java 模块演示 Spring Boot 统一返回体（code / message / data /
            requestId）与驾驶舱指标约定，便于前后端联调答辩，不是独立 JVM 进程。
          </p>
          <div className={styles.tags}>
            <span className={styles.tag}>Java 契约</span>
            <span className={styles.tag}>前端 · React</span>
            <span className={styles.tag}>后端 · API</span>
            <span className={styles.tag}>业务机器人</span>
            <span className={styles.tag}>AI · SSE/RAG/Agent</span>
          </div>
        </section>

        <div className={styles.map}>
          {MAP.map((item) => (
            <a key={item.href} className={styles.mapCard} href={item.href}>
              <strong>{item.title}</strong>
              <span>{item.desc}</span>
            </a>
          ))}
        </div>

        <nav className={styles.toc} aria-label="模块跳转">
          {MAP.map((item) => (
            <a key={`toc-${item.href}`} href={item.href}>
              {item.title}
            </a>
          ))}
        </nav>

        <div className={styles.grid}>
          <section id="bot" className={`${styles.card} ${styles.wide}`}>
            <div className={styles.cardHead}>
              <h2>
                1. 业务机器人
                <span className={styles.badge}>综合入口 · AI</span>
              </h2>
              <span className={`${styles.statusDot} ${botDone ? styles.on : ""}`} />
            </div>
            <p className={styles.meta}>
              一路由多工具，对应简历 TripPal / 知识库 / 填表 Agent / 审批后台。先点建议话术，再看意图与项目映射。
            </p>
            <div className={styles.actions}>
              {botSuggestions.map((s) => (
                <button key={s} type="button" disabled={botBusy} onClick={() => runBot(s)}>
                  {s}
                </button>
              ))}
            </div>
            <div className={styles.row} style={{ marginTop: 10 }}>
              <input
                className={styles.field}
                value={botMsg}
                onChange={(e) => setBotMsg(e.target.value)}
                placeholder="对机器人说一句话"
                onKeyDown={(e) => {
                  if (e.key === "Enter") runBot();
                }}
              />
            </div>
            <div className={styles.actions}>
              <button className={styles.primary} type="button" disabled={botBusy} onClick={() => runBot()}>
                {botBusy ? "思考中…" : "发送"}
              </button>
              <button type="button" disabled={botBusy || botChat.length === 0} onClick={() => setBotChat([])}>
                清空对话
              </button>
            </div>
            <div className={styles.chat}>
              {botChat.length === 0 && (
                <div className={`${styles.bubble} ${styles.bubbleBot}`}>
                  你好。我可以演示行程规划、知识库问答、招商填表与档案审批四条简历能力链路。
                </div>
              )}
              {botChat.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={`${styles.bubble} ${m.role === "user" ? styles.bubbleUser : styles.bubbleBot}`}
                >
                  <div>{m.text}</div>
                  {m.role === "bot" && (
                    <div className={styles.bubbleMeta}>
                      {m.intent && <span className={`${styles.chip} ${styles.chipAccent}`}>{m.intent}</span>}
                      {m.resumeProject && <span className={styles.chip}>{m.resumeProject}</span>}
                      {typeof m.latencyMs === "number" && (
                        <span className={styles.chip}>{m.latencyMs} ms</span>
                      )}
                    </div>
                  )}
                  {m.steps && m.steps.length > 0 && (
                    <ol className={styles.steps}>
                      {m.steps.map((s, idx) => (
                        <li key={`${s.role}-${idx}`}>
                          [{s.role}] {s.text}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </section>

          <section id="java" className={styles.card}>
            <div className={styles.cardHead}>
              <h2>
                2. Java 风格后端契约
                <span className={styles.badge}>Java · 后端</span>
              </h2>
              <span className={`${styles.statusDot} ${javaDone ? styles.on : ""}`} />
            </div>
            <p className={styles.meta}>
              统一返回 code / message / data / requestId；驾驶舱指标对齐「产业园区可视化驾驶舱」。
            </p>
            <div className={styles.resumeTag}>简历映射：驾驶舱数据面 + Spring Result 约定</div>
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
            {javaLatency !== null && (
              <div className={styles.summary}>
                <span className={styles.summaryItem}>latency={javaLatency}ms</span>
              </div>
            )}
            {javaMetrics.length > 0 && (
              <div className={styles.metrics}>
                {javaMetrics.map((m) => (
                  <div key={m.name} className={styles.metric}>
                    <div className={styles.label}>{m.name}</div>
                    <div className={styles.value}>
                      {m.value}
                      <span style={{ fontSize: "0.75rem", marginLeft: 4 }}>{m.unit}</span>
                    </div>
                    {m.trend && <div className={styles.trend}>{m.trend}</div>}
                  </div>
                ))}
              </div>
            )}
            <pre className={styles.out}>{javaOut || "点击按钮查看 Java 风格 JSON…"}</pre>
          </section>

          <section id="sse" className={styles.card}>
            <div className={styles.cardHead}>
              <h2>
                3. SSE 流式（POST）
                <span className={styles.badge}>前端 + 后端</span>
              </h2>
              <span className={`${styles.statusDot} ${sseDone ? styles.on : ""}`} />
            </div>
            <p className={styles.meta}>
              fetch + ReadableStream；JSON Body（非 EventSource）；Abort 取消；响应头 X-Request-Id。
            </p>
            <div className={styles.resumeTag}>简历映射：TripPal SSE 协议与弱网取消</div>
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

          <section id="rag" className={styles.card}>
            <div className={styles.cardHead}>
              <h2>
                4. 迷你知识库 RAG
                <span className={styles.badge}>AI · 检索</span>
              </h2>
              <span className={`${styles.statusDot} ${ragDone ? styles.on : ""}`} />
            </div>
            <p className={styles.meta}>
              本地语料 {corpus.length} 篇；BM25 风格打分 + 引用；无命中返回「资料不足」，不编造。
            </p>
            <div className={styles.resumeTag}>简历映射：工程机械私有知识库 / H5 门户</div>
            <textarea
              className={styles.fieldArea}
              value={ragQuery}
              onChange={(e) => setRagQuery(e.target.value)}
            />
            <div className={styles.actions}>
              <button className={styles.primary} type="button" disabled={ragBusy} onClick={() => runRag()}>
                {ragBusy ? "检索中…" : "检索并回答"}
              </button>
              <button type="button" disabled={ragBusy} onClick={() => runRag("SSE 为什么要 Abort")}>
                试：SSE Abort
              </button>
              <button type="button" disabled={ragBusy} onClick={() => runRag("火星发动机说明书")}>
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

          <section id="planner" className={`${styles.card} ${styles.wide}`}>
            <div className={styles.cardHead}>
              <h2>
                5. Research→Planner · Mock / 软超时分离
                <span className={styles.badge}>AI · Agent</span>
              </h2>
              <span className={`${styles.statusDot} ${planDone ? styles.on : ""}`} />
            </div>
            <p className={styles.meta}>
              <b>mock_whitelist</b>：预制摘要；<b>live_research</b>：模拟检索 + 软超时跳过。二者隔离。可注入跳点脏数据走
              ContractGuard。
            </p>
            <div className={styles.resumeTag}>简历映射：TripPal Research→Planner</div>
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
            {planSummary.length > 0 && (
              <div className={styles.summary}>
                {planSummary.map((s) => (
                  <span key={s} className={styles.summaryItem}>
                    {s}
                  </span>
                ))}
              </div>
            )}
            <pre className={styles.out}>{planOut || "运行后展示 Research / Planner / Contract JSON…"}</pre>
          </section>

          <section id="form" className={`${styles.card} ${styles.wide}`}>
            <div className={styles.cardHead}>
              <h2>
                6. 槽位 + 工具填表 Agent
                <span className={styles.badge}>AI · 业务 Agent</span>
              </h2>
              <span className={`${styles.statusDot} ${formDone ? styles.on : ""}`} />
            </div>
            <p className={styles.meta}>
              受约束槽位机；工具 lookupCompany（本地 mock）。参与口径演示，非完整 LangGraph。
            </p>
            <div className={styles.resumeTag}>简历映射：政务招商表单材料智能填充 Agent</div>
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
                  setFormOut("");
                  setFormDone(false);
                }}
              >
                重置试 grkj
              </button>
            </div>
            {Object.keys(formSlots).length > 0 && (
              <div className={styles.slots}>
                {Object.entries(formSlots).map(([k, v]) => (
                  <div key={k} className={styles.slot}>
                    <em>{k}</em>
                    {v || "—"}
                  </div>
                ))}
              </div>
            )}
            <pre className={styles.out}>{formOut || "槽位 / 工具 trace 将显示在这里…"}</pre>
          </section>
        </div>

        <p className={styles.footer}>
          建议演示顺序：机器人四意图 → Java 驾驶舱 → SSE Abort → RAG 空结果 → Planner 软超时 → 填表
          grkj。源码：<code>/lab</code>、<code>/api/lab/*</code>
        </p>
      </main>
    </div>
  );
}
