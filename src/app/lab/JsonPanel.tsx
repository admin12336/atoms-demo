"use client";

import { useState } from "react";
import styles from "./page.module.css";

export function JsonPanel({
  text,
  empty,
  defaultOpen = false,
}: {
  text: string;
  empty: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!text) {
    return <pre className={styles.out}>{empty}</pre>;
  }
  return (
    <div className={styles.jsonWrap}>
      <button className={styles.jsonToggle} type="button" onClick={() => setOpen((v) => !v)}>
        {open ? "收起原始 JSON" : "展开原始 JSON（手机可先看上方摘要）"}
      </button>
      {open ? <pre className={styles.out}>{text}</pre> : null}
    </div>
  );
}
