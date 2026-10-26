"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import PasswordField from "../components/PasswordField";
import styles from "../auth.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "登录失败");
      router.push("/studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
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
        <h1>登录工坊</h1>
        <p>进入后可创建项目、批准方案并预览生成应用。</p>
        <p className={styles.tip}>
          登录后 Cookie 约 14 天有效：同一浏览器刷新/再开一般不用重新登录。换设备、清 Cookie
          或过期后，用原邮箱密码登录即可；若提示账号不存在，再注册一次。
        </p>
        <form className={styles.form} onSubmit={onSubmit}>
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
            autoComplete="current-password"
          />
          {error ? <p className={styles.error}>{error}</p> : null}
          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? "登录中…" : "登录"}
          </button>
        </form>
        <p className={styles.foot}>
          还没有账号？ <Link href="/register">去注册</Link>
        </p>
      </div>
    </div>
  );
}
