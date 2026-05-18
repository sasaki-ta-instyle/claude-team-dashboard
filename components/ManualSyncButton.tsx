"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ManualSyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/claude-team-dashboard/api/sync", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.errorMessage || body.error || `HTTP ${res.status}`);
        return;
      }
      setResult(`${body.daysProcessed} 日 / ${body.membersSynced} 人 / ${body.recordsUpserted} レコード`);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <button className="btn btn--primary" onClick={run} disabled={loading}>
        {loading ? "同期中…（最大数十秒）" : "今すぐ同期"}
      </button>
      {result && <span style={{ fontSize: "0.8125rem", color: "var(--color-success)" }}>✓ {result}</span>}
      {error && <span style={{ fontSize: "0.8125rem", color: "var(--color-error)" }}>{error}</span>}
    </div>
  );
}
