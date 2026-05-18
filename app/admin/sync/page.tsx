import Link from "next/link";
import { getRecentSyncLogs, getOverview } from "@/lib/queries";
import { AppHeader } from "@/components/AppHeader";
import { ManualSyncButton } from "@/components/ManualSyncButton";
import { formatDateJP } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function SyncPage() {
  const overview = getOverview("month"); // last sync 表示のため
  const logs = getRecentSyncLogs(20);

  const envStatus = {
    adminKey: !!process.env.ANTHROPIC_ADMIN_API_KEY,
    passwordHash: !!process.env.ADMIN_PASSWORD_HASH,
    sessionSecret: !!process.env.SESSION_SECRET,
    syncToken: !!process.env.SYNC_TOKEN,
    lookback: process.env.SYNC_LOOKBACK_DAYS ?? "90 (default)",
  };

  return (
    <div className="app-shell">
      <AppHeader lastSyncedAt={overview.lastSyncedAt} />

      <main className="app-main container">
        <div style={{ marginBottom: 16 }}>
          <Link href="/" className="btn btn--ghost">← ダッシュボードに戻る</Link>
        </div>

        <h1 style={{ fontSize: "1.6875rem", fontWeight: 500, marginBottom: 16 }}>同期</h1>

        <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="kpi__label" style={{ marginBottom: 8 }}>手動同期</div>
            <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
              Anthropic Admin API を叩いて過去 {envStatus.lookback} 日分の Claude Code 使用量を取得します。
            </div>
          </div>
          <ManualSyncButton />
        </div>

        <section className="section">
          <header className="section__head">
            <h2 className="section__title">環境設定の確認</h2>
            <div className="section__sub">サーバ env の有無のみを表示します。値は表示しません。</div>
          </header>
          <div className="card">
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <EnvStatusItem label="ANTHROPIC_ADMIN_API_KEY" ok={envStatus.adminKey} />
              <EnvStatusItem label="ADMIN_PASSWORD_HASH" ok={envStatus.passwordHash} />
              <EnvStatusItem label="SESSION_SECRET" ok={envStatus.sessionSecret} />
              <EnvStatusItem label="SYNC_TOKEN (cron 用、任意)" ok={envStatus.syncToken} optional />
            </ul>
          </div>
        </section>

        <section className="section">
          <header className="section__head">
            <h2 className="section__title">同期ログ</h2>
            <div className="section__sub">直近 20 件</div>
          </header>
          {logs.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>まだ実行されていません</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>開始</th>
                    <th>終了</th>
                    <th>ステータス</th>
                    <th className="num">対象日数</th>
                    <th className="num">メンバー</th>
                    <th className="num">レコード</th>
                    <th>起動元</th>
                    <th>エラー</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDateJP(l.started_at)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDateJP(l.ended_at)}</td>
                      <td>
                        <span className={l.status === "success" ? "badge badge--success" : l.status === "error" ? "badge badge--error" : "badge badge--default"}>
                          {l.status}
                        </span>
                      </td>
                      <td className="num">{l.days_processed}</td>
                      <td className="num">{l.members_synced}</td>
                      <td className="num">{l.records_upserted}</td>
                      <td style={{ color: "var(--color-text-muted)" }}>{l.triggered_by ?? "—"}</td>
                      <td style={{ color: "var(--color-error)", fontSize: "0.75rem", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {l.error_message ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function EnvStatusItem({ label, ok, optional }: { label: string; ok: boolean; optional?: boolean }) {
  return (
    <li style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>{label}</span>
      <span className={ok ? "badge badge--success" : optional ? "badge badge--default" : "badge badge--error"}>
        {ok ? "設定済み" : optional ? "未設定（任意）" : "未設定"}
      </span>
    </li>
  );
}
