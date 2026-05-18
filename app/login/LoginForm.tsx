"use client";

import { useState } from "react";

export function LoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/claude-team-dashboard/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          body.error === "invalid_password"
            ? "パスワードが違います"
            : body.error === "server_not_configured"
            ? "サーバ側のパスワードが未設定です。管理者に連絡してください。"
            : "ログインに失敗しました"
        );
        return;
      }
      // basePath は Next.js が自動で付ける。next は basePath を含まないパス想定
      const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      window.location.assign(safeNext === "/" ? "/claude-team-dashboard/" : `/claude-team-dashboard${safeNext}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input
        className="input"
        type="password"
        placeholder="共通パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        autoFocus
        required
      />
      {error && (
        <div style={{ color: "var(--color-error)", fontSize: "0.8125rem" }}>{error}</div>
      )}
      <button className="btn btn--primary" type="submit" disabled={loading || !password}>
        {loading ? "確認中…" : "ログイン"}
      </button>
    </form>
  );
}
