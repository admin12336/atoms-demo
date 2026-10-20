"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SharePage() {
  const params = useParams<{ token: string }>();
  const [title, setTitle] = useState("分享预览");
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/share/${params.token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setTitle(d.share.title);
        setHtml(d.share.html);
      })
      .catch(() => setError("加载失败"));
  }, [params.token]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateRows: "48px 1fr" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid #2a3a32",
        }}
      >
        <strong>{title}</strong>
        <Link href="/">Atoms Demo</Link>
      </header>
      {error ? (
        <div style={{ padding: 24, color: "#ef6b5b" }}>{error}</div>
      ) : (
        <iframe
          title="shared-preview"
          style={{ width: "100%", height: "100%", border: 0, background: "white" }}
          sandbox="allow-scripts allow-forms allow-same-origin"
          srcDoc={html}
        />
      )}
    </div>
  );
}
