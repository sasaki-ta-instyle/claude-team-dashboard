"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Seat = "premium" | "standard" | null;

export function SeatTagControl({
  email,
  seat: initialSeat,
  source,
  compact = false,
}: {
  email: string;
  seat: Seat;
  source?: string | null;
  compact?: boolean;
}) {
  const [seat, setSeat] = useState<Seat>(initialSeat);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function update(next: Seat) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/claude-team-dashboard/api/members/${encodeURIComponent(email)}/seat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seat: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "更新失敗");
        return;
      }
      setSeat(next);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  const sourceLabel =
    source === "anthropic-api"
      ? "（API 取得）"
      : source && source.startsWith("ui:")
      ? "（手動）"
      : "";

  if (compact) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <select
          className="input"
          value={seat ?? ""}
          onChange={(e) => update((e.target.value || null) as Seat)}
          disabled={saving}
          style={{ padding: "4px 8px", fontSize: "0.75rem", width: "auto", background: seat === "premium" ? "var(--color-text)" : "var(--color-surface-2)", color: seat === "premium" ? "var(--color-text-inverse)" : "var(--color-text)" }}
          aria-label={`${email} の seat`}
        >
          <option value="">未設定</option>
          <option value="premium">premium</option>
          <option value="standard">standard</option>
        </select>
        {error && <span style={{ fontSize: "0.7rem", color: "var(--color-error)" }}>{error}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select
          className="input"
          value={seat ?? ""}
          onChange={(e) => update((e.target.value || null) as Seat)}
          disabled={saving}
          style={{ width: 200 }}
        >
          <option value="">未設定</option>
          <option value="premium">premium</option>
          <option value="standard">standard</option>
        </select>
        <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{sourceLabel}</span>
      </div>
      {error && <span style={{ fontSize: "0.75rem", color: "var(--color-error)" }}>{error}</span>}
    </div>
  );
}
