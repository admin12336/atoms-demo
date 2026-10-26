"use client";

import { useState } from "react";
import styles from "../auth.module.css";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  minLength?: number;
  required?: boolean;
  autoComplete?: string;
};

export default function PasswordField({
  value,
  onChange,
  label = "密码",
  placeholder = "至少 6 位",
  minLength = 6,
  required = true,
  autoComplete = "current-password",
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <label className={styles.field}>
      {label}
      <div className={styles.passwordWrap}>
        <input
          className={`${styles.fieldInput} ${styles.passwordInput}`}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className={styles.eyeBtn}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "隐藏密码" : "显示密码"}
          title={visible ? "隐藏密码" : "显示密码"}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </label>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18M10.6 10.7a3.2 3.2 0 004.5 4.5M9.5 5.3A10.4 10.4 0 0112 5c6 0 9.5 7 9.5 7a16.6 16.6 0 01-3.2 3.9M6.2 6.3C4 8 2.5 12 2.5 12S6 19 12 19c1.3 0 2.5-.3 3.6-.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
