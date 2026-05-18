import Link from "next/link";
import { getOverview, type Period, periodToDays } from "@/lib/queries";
import { formatNumber, formatUsd, formatDateJP, daysAgo } from "@/lib/format";
import { AppHeader } from "@/components/AppHeader";
import { PeriodSwitch } from "@/components/PeriodSwitch";
import { SeatTagControl } from "@/components/SeatTagControl";

export const dynamic = "force-dynamic";

function isPeriod(v: string | undefined): v is Period {
  return v === "day" || v === "week" || v === "month";
}

function periodLabel(p: Period): string {
  if (p === "day") return "1 日";
  if (p === "week") return "7 日";
  return "30 日";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const period: Period = isPeriod(sp.period) ? sp.period : "month";
  const overview = getOverview(period);
  const days = periodToDays(period);

  return (
    <div className="app-shell">
      <AppHeader lastSyncedAt={overview.lastSyncedAt} />

      <main className="app-main container">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
          <h1 style={{ fontSize: "1.6875rem", fontWeight: 500 }}>メンバー使用量</h1>
          <PeriodSwitch current={period} />
        </div>

        <div className="kpi-grid">
          <Kpi label={`アクティブメンバー（${periodLabel(period)}）`} value={`${overview.activeCount}`} sub={`/ ${overview.members.length} 人中`} />
          <Kpi label="Premium 配布" value={`${overview.premiumCount}`} sub={`Standard ${overview.standardCount} / 未設定 ${overview.members.length - overview.premiumCount - overview.standardCount}`} />
          <Kpi label={`Claude Code 推定コスト（${periodLabel(period)}）`} value={formatUsd(overview.totalCostCents)} sub={`期間 ${overview.range.start} 〜 ${overview.range.end} (UTC)`} />
          <Kpi label={`Code セッション（${periodLabel(period)}）`} value={formatNumber(overview.totalSessions)} sub="distinct sessions" />
        </div>

        {overview.underutilizedPremium.length > 0 && (
          <section className="section">
            <header className="section__head">
              <div>
                <h2 className="section__title"><span className="dot dot--warning" />使えていない可能性のある Premium</h2>
                <div className="section__sub">期間内に Code セッション 0、または Standard 相当（${(2500 * days / 30 / 100).toFixed(2)} 未満）のコストしか出ていない Premium ユーザー</div>
              </div>
            </header>
            <MemberTable rows={overview.underutilizedPremium} highlight="warning" />
          </section>
        )}

        {overview.premiumCandidates.length > 0 && (
          <section className="section">
            <header className="section__head">
              <div>
                <h2 className="section__title"><span className="dot dot--success" />Premium 検討候補</h2>
                <div className="section__sub">Standard / 未設定だが、期間内コストが組織内の上位 20% に入るユーザー</div>
              </div>
            </header>
            <MemberTable rows={overview.premiumCandidates} highlight="success" />
          </section>
        )}

        <section className="section">
          <header className="section__head">
            <div>
              <h2 className="section__title">全メンバー</h2>
              <div className="section__sub">{overview.members.length} 人 · 期間 {overview.range.start} 〜 {overview.range.end} (UTC)</div>
            </div>
          </header>
          <MemberTable rows={overview.members} />
        </section>

        <div className="notice" style={{ marginTop: 32 }}>
          <span>ⓘ</span>
          <div>
            <strong>Chat (claude.ai) と Cowork の per-user 使用量は表示できません。</strong>
            Anthropic Team プランの Admin API では Claude Code の per-user 使用量しか取得できないため、ここに表示されるすべての数値は Claude Code 経由の活動です。Chat/Cowork の per-user 計測には Enterprise プランの Analytics API 契約が必要です。
          </div>
        </div>

        <footer style={{ marginTop: 64, paddingTop: 24, color: "var(--color-text-muted)", fontSize: "0.75rem", display: "flex", justifyContent: "space-between" }}>
          <span>最終同期: {formatDateJP(overview.lastSyncedAt)}</span>
          <Link href="/admin/sync">同期画面へ →</Link>
        </footer>
      </main>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="kpi">
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">{value}</div>
      {sub && <div className="kpi__sub">{sub}</div>}
    </div>
  );
}

function MemberTable({ rows, highlight }: { rows: ReturnType<typeof getOverview>["members"]; highlight?: "warning" | "success" }) {
  if (rows.length === 0) {
    return <div className="card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>該当なし</div>;
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>メンバー</th>
            <th>Role</th>
            <th>Seat</th>
            <th className="num">セッション</th>
            <th className="num">コミット</th>
            <th className="num">行 +/−</th>
            <th className="num">推定コスト</th>
            <th>最終アクティビティ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.email}>
              <td>
                <Link href={`/members/${encodeURIComponent(m.email)}`} style={{ textDecoration: "none" }}>
                  <span style={{ fontWeight: 500 }}>{m.email}</span>
                </Link>
              </td>
              <td style={{ color: "var(--color-text-muted)" }}>{m.role ?? "—"}</td>
              <td>
                <SeatTagControl email={m.email} seat={m.seat} source={m.seat_source} compact />
              </td>
              <td className="num">{formatNumber(m.sessions)}</td>
              <td className="num">{formatNumber(m.commits)}</td>
              <td className="num" style={{ color: "var(--color-text-muted)" }}>
                <span style={{ color: "var(--color-success)" }}>+{formatNumber(m.lines_added)}</span>
                {" / "}
                <span style={{ color: "var(--color-error)" }}>−{formatNumber(m.lines_removed)}</span>
              </td>
              <td className="num">{formatUsd(m.cost_cents)}</td>
              <td style={{ color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>{daysAgo(m.last_active_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
