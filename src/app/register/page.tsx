"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import PasswordField from "../components/PasswordField";
import styles from "../auth.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "注册失败");
      router.push("/studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.brand}>
          Atoms <span>Demo</span>
        </div>
        <h1>创建账号</h1>
        <p>注册成功会自动登录并进入工坊。</p>
        <p className={styles.tip}>
          登录态会写入浏览器 Cookie（约 14 天）：下次同一浏览器打开站点，一般直接进工坊，不必重新注册。
          换电脑/清 Cookie 后，优先「去登录」；只有账号确实不存在时才需再注册。
        </p>
        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.field}>
            显示名
            <input
              className={styles.fieldInput}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={40}
              placeholder="例如：晓亮"
              autoComplete="nickname"
            />
          </label>
          <label className={styles.field}>
            邮箱
            <input
              className={styles.fieldInput}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          <PasswordField
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          {error ? <p className={styles.error}>{error}</p> : null}
          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? "创建中…" : "注册并进入"}
          </button>
        </form>
        <p className={styles.foot}>
          已有账号？ <Link href="/login">去登录</Link>
        </p>
      </div>
    </div>
  );
}
