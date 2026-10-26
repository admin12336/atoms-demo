"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Project, PublicUser } from "@/lib/types";
import { IDEA_TEMPLATES, PENDING_IDEA_KEY } from "@/lib/templates";
import styles from "./studio.module.css";

type Device = "desktop" | "tablet" | "mobile";

export default function StudioPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [llmMode, setLlmMode] = useState<"live" | "demo" | "unset">("unset");
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamHint, setStreamHint] = useState("");
  const [error, setError] = useState("");
  const [device, setDevice] = useState<Device>("desktop");
  const [weatherText, setWeatherText] = useState("天气加载中…");
  const abortRef = useRef<AbortController | null>(null);

  const active = useMemo(
    () => projects.find((p) => p.id === activeId) ?? null,
    [projects, activeId],
  );

  const activeHtml = useMemo(() => {
    if (!active?.activeVersionId) return "";
    return active.versions.find((v) => v.id === active.activeVersionId)?.html ?? "";
  }, [active]);

  const refreshMe = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    if (!data.user) {
      router.replace("/login");
      return;
    }
    setUser(data.user);
    setLlmMode(data.llmMode);
  }, [router]);

  const refreshProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    const data = await res.json();
    setProjects(data.projects ?? []);
    setActiveId((prev) => prev ?? data.projects?.[0]?.id ?? null);
  }, [router]);

  useEffect(() => {
    refreshMe();
    refreshProjects();
    fetch("/api/weather")
      .then((r) => r.json())
      .then((d) => {
        if (d.weather) {
          const w = d.weather;
          setWeatherText(`${w.city} · ${w.label} ${w.temperature}°C · 风速 ${w.windspeed}`);
        } else {
          setWeatherText("天气暂不可用");
        }
      })
      .catch(() => setWeatherText("天气暂不可用"));
  }, [refreshMe, refreshProjects]);

  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_IDEA_KEY);
    if (!pending || !user || busy) return;
    sessionStorage.removeItem(PENDING_IDEA_KEY);
    createProject(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only auto-start once after login
  }, [user]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  async function createProject(idea?: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      setProjects((prev) => [data.project, ...prev]);
      setActiveId(data.project.id);
      if (idea) {
        await runAgent(data.project.id, "plan", idea);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  function abortAgent() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setStreamHint("已 Abort 取消生成");
  }

  async function runAgent(projectId: string, action: "plan" | "build" | "iterate", content?: string) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    setError("");
    setStreamHint(action === "plan" ? "Emma 规划中…" : "Alex SSE 流式生成中…（可 Abort）");
    try {
      const res = await fetch(`/api/projects/${projectId}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ action, content, stream: action !== "plan" }),
        signal: ac.signal,
      });

      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let lastProject: Project | null = null;
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
              if (event === "status") {
                setStreamHint(String(json.text || ""));
              } else if (event === "message") {
                const t = String(json.text || "");
                if (t) setStreamHint((prev) => (prev.length > 120 ? prev.slice(-80) : prev) + (t.length > 40 ? "…" : t.slice(0, 8)));
              } else if (event === "error") {
                setError(String(json.message || "流式错误"));
              } else if (event === "done" && json.project) {
                lastProject = json.project as Project;
              }
            } catch {
              /* ignore partial */
            }
          }
        }
        if (lastProject) {
          setProjects((prev) => prev.map((p) => (p.id === lastProject!.id ? lastProject! : p)));
        } else {
          await refreshProjects();
        }
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "执行失败");
      setProjects((prev) => prev.map((p) => (p.id === data.project.id ? data.project : p)));
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStreamHint("已 Abort 取消");
        await refreshProjects();
        return;
      }
      setError(err instanceof Error ? err.message : "执行失败");
      await refreshProjects();
    } finally {
      setBusy(false);
      abortRef.current = null;
      setStreamHint("");
    }
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    if (!active) {
      setInput("");
      await createProject(text);
      return;
    }

    setInput("");
    if (active.status === "ready" && active.activeVersionId) {
      await runAgent(active.id, "iterate", text);
    } else {
      await runAgent(active.id, "plan", text);
    }
  }

  async function restoreVersion(versionId: string) {
    if (!active) return;
    const res = await fetch(`/api/projects/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeVersionId: versionId }),
    });
    const data = await res.json();
    if (res.ok) {
      setProjects((prev) => prev.map((p) => (p.id === data.project.id ? data.project : p)));
    }
  }

  function exportHtml() {
    if (!activeHtml) return;
    const blob = new Blob([activeHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active?.title || "atoms-app"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function sharePreview() {
    if (!active) return;
    const res = await fetch(`/api/projects/${active.id}/share`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "分享失败");
      return;
    }
    const link = `${window.location.origin}${data.path}`;
    await navigator.clipboard.writeText(link);
    alert(`分享链接已复制：\n${link}`);
  }

  const frameClass =
    device === "mobile"
      ? `${styles.frameShell} ${styles.frameShellMobile}`
      : device === "tablet"
        ? `${styles.frameShell} ${styles.frameShellTablet}`
        : styles.frameShell;

  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          Atoms <span>Demo</span>
        </Link>
        <div className={styles.meta}>
          <span className={`${styles.pill} ${llmMode === "live" ? styles.pillLive : styles.pillDemo}`}>
            {llmMode === "live" ? "LLM 实机" : llmMode === "demo" ? "演示模式" : "未配置"}
          </span>
          <span>{user?.displayName}</span>
          <button className={styles.ghostBtn} onClick={logout} type="button">
            退出
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.side}>
          <div className={styles.weather}>
            <strong>Open-Meteo</strong>
            <div>{weatherText}</div>
          </div>
          <div className={styles.sideHead}>
            <h2>项目</h2>
            <button className={styles.newBtn} type="button" disabled={busy} onClick={() => createProject()}>
              新建
            </button>
          </div>
          <div className={styles.projectList}>
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`${styles.projectItem} ${p.id === activeId ? styles.projectItemActive : ""}`}
                onClick={() => setActiveId(p.id)}
              >
                <strong>{p.title}</strong>
                <span>
                  {p.status} · {p.versions.length} 版本
                </span>
              </button>
            ))}
            {!projects.length ? <p className={styles.empty}>还没有项目，先描述一个想法吧。</p> : null}
          </div>
        </aside>

        <section className={styles.chat}>
          <div className={styles.messages}>
            {!active ? (
              <div className={styles.emptyHero}>
                <h2>把想法变成可运行的应用</h2>
                <p>用一句话描述需求。Emma 先出方案，你批准后 Alex 生成可交互页面，右侧即时预览。</p>
              </div>
            ) : (
              active.messages.map((m) => {
                if (m.kind === "plan" && m.plan) {
                  return (
                    <div key={m.id} className={styles.planCard}>
                      <h3>Emma 方案 · {m.plan.title}</h3>
                      <p>{m.plan.summary}</p>
                      <ul>
                        {m.plan.features.slice(0, 6).map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                      {active.status === "awaiting_approval" ? (
                        <button
                          className={styles.approveBtn}
                          type="button"
                          disabled={busy}
                          onClick={() => runAgent(active.id, "build")}
                        >
                          批准并生成
                        </button>
                      ) : null}
                    </div>
                  );
                }
                return (
                  <div
                    key={m.id}
                    className={`${styles.bubble} ${m.role === "user" ? styles.bubbleUser : ""} ${
                      m.kind === "error" ? styles.bubbleError : ""
                    }`}
                  >
                    {m.content}
                  </div>
                );
              })
            )}
            {streamHint ? <div className={styles.bubble}>{streamHint}</div> : null}
            {error ? <div className={`${styles.bubble} ${styles.bubbleError}`}>{error}</div> : null}
          </div>

          <form className={styles.composer} onSubmit={onSend}>
            <div className={styles.templates}>
              {IDEA_TEMPLATES.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!active) {
                      createProject(t);
                    } else {
                      setInput(t);
                    }
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className={styles.row}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  active?.status === "ready"
                    ? "描述要修改的地方，例如：把主色换成绿色"
                    : "输入你的想法，例如：咖啡店落地页，含菜单和预约表单"
                }
              />
              <button type="submit" disabled={busy || !input.trim()}>
                {busy ? "…" : "发送"}
              </button>
              {busy ? (
                <button type="button" className={styles.ghostBtn} onClick={abortAgent}>
                  Abort
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className={styles.preview}>
          <div className={styles.previewBar}>
            <select value={device} onChange={(e) => setDevice(e.target.value as Device)}>
              <option value="desktop">桌面</option>
              <option value="tablet">平板</option>
              <option value="mobile">手机</option>
            </select>
            <select
              value={active?.activeVersionId ?? ""}
              onChange={(e) => restoreVersion(e.target.value)}
              disabled={!active?.versions.length}
            >
              {!active?.versions.length ? <option value="">无版本</option> : null}
              {active?.versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                  {v.note ? ` · ${v.note}` : ""}
                </option>
              ))}
            </select>
            <button type="button" onClick={exportHtml} disabled={!activeHtml}>
              导出 HTML
            </button>
            <button type="button" onClick={sharePreview} disabled={!activeHtml}>
              分享预览
            </button>
          </div>
          <div className={styles.frameWrap}>
            {activeHtml ? (
              <div className={frameClass}>
                <iframe className={styles.frame} title="preview" sandbox="allow-scripts allow-forms allow-same-origin" srcDoc={activeHtml} />
              </div>
            ) : (
              <div className={styles.previewEmpty}>
                预览区空着。
                <br />
                批准 Emma 的方案后，这里会出现可点击的应用。
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
