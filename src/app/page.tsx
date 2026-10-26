"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { IDEA_TEMPLATES, PENDING_IDEA_KEY } from "@/lib/templates";
import styles from "./page.module.css";

const STEPS = [
  {
    n: "01",
    title: "描述需求",
    desc: "用中文写下你想要的功能和风格，引擎解析为结构化指令。",
  },
  {
    n: "02",
    title: "自动生成",
    desc: "AI 输出完整的单文件网页应用，右侧预览即可点击体验。",
  },
  {
    n: "03",
    title: "对话迭代",
    desc: "在预览旁继续提修改，版本自动存档，可回滚、可导出。",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);

  async function startWithIdea(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      sessionStorage.setItem(PENDING_IDEA_KEY, text);
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      router.push(data.user ? "/studio" : "/register");
    } catch {
      router.push("/register");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    startWithIdea(idea);
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          Atoms <span>Demo</span>
        </div>
        <div className={styles.navActions}>
          <Link className={styles.btnGhost} href="/lab">
            能力实验室
          </Link>
          <Link className={styles.btnGhost} href="/login">
            登录
          </Link>
          <Link className={styles.btn} href="/register">
            开始构建
          </Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <p className={styles.kicker}>对标 atoms.dev · 一句话到可运行网页</p>
        <h1>把想法变成可运行的应用</h1>
        <p className={styles.lead}>
          用一句话描述需求，AI 实时生成完整可运行的代码。对话即迭代，每个版本自动存档，随时回滚与导出。
        </p>

        <form className={styles.promptBox} onSubmit={onSubmit}>
          <label className={styles.promptLabel} htmlFor="idea">
            输入你的想法
          </label>
          <div className={styles.promptRow}>
            <textarea
              id="idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="例如：做一个带分类图表的个人记账本…"
              rows={3}
            />
            <button type="submit" disabled={busy || !idea.trim()}>
              {busy ? "跳转中…" : "开始生成"}
            </button>
          </div>
          <div className={styles.chips}>
            {IDEA_TEMPLATES.map((t) => (
              <button key={t} type="button" disabled={busy} onClick={() => startWithIdea(t)}>
                {t}
              </button>
            ))}
          </div>
        </form>
      </section>

      <section className={styles.steps}>
        {STEPS.map((s) => (
          <article key={s.n} className={styles.step}>
            <span className={styles.stepN}>{s.n}</span>
            <h2>{s.title}</h2>
            <p>{s.desc}</p>
          </article>
        ))}
      </section>

      <section className={styles.stats}>
        <div>
          <strong>&lt; 60s</strong>
          <span>平均构建耗时</span>
        </div>
        <div>
          <strong>100%</strong>
          <span>可运行代码，非伪代码</span>
        </div>
        <div>
          <strong>∞</strong>
          <span>版本存档与回滚次数</span>
        </div>
      </section>
    </div>
  );
}
