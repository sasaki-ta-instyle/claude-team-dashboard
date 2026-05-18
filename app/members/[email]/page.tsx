import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberDetail, getOverview, type Period } from "@/lib/queries";
import { formatNumber, formatUsd, formatDateJP, daysAgo, formatDateOnly } from "@/lib/format";
import { AppHeader } from "@/components/AppHeader";
import { PeriodSwitch } from "@/components/PeriodSwitch";
import { SeatTagControl } from "@/components/SeatTagControl";
import { MemberDailyChart } from "@/components/MemberDailyChart";

export const dynamic = "force-dynamic";

function isPeriod(v: string | undefined): v is Period {
  return v === "day" || v === "week" || v === "month";
}

function acceptRate(a: number, r: number): string {
  if (a + r === 0) return "—";
  return `${Math.round((a / (a + r)) * 100)}%`;
}

export default async function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ email: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { email: rawEmail } = await params;
  const sp = await searchParams;
  const email = decodeURIComponent(rawEmail);
  const period: Period = isPeriod(sp.period) ? sp.period : "month";
  const detail = getMemberDetail(email, period);
  if (!detail) notFound();

  const lastSync = getOverview(period).lastSyncedAt;
  const t = detail.totals;

  return (
    <div className="app-shell">
      <AppHeader lastSyncedAt={lastSync} />

      <main className="app-main container">
        <div style={{ marginBottom: 16 }}>
          <Link href="/" className="btn btn--ghost">← ダッシュボードに戻る</Link>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {detail.role ?? "—"}
            </div>
            <h1 style={{ fontSize: "1.6875rem", fontWeight: 500, marginTop: 4 }}>{detail.email}</h1>
            <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginTop: 4 }}>
              最終アクティビティ: {daysAgo(detail.lastActiveDate)} ({formatDateOnly(detail.lastActiveDate)})
              {detail.terminalType && ` · 主環境: ${detail.terminalType}`}
            </div>
          </div>
          <PeriodSwitch current={period} />
        </div>

        <div className="card" style={{ marginTop: 24, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div className="kpi__label" style={{ marginBottom: 8 }}>Seat 種別</div>
            <SeatTagControl email={detail.email} seat={detail.seat} source={detail.seat_source} />
          </div>
          {detail.seat_updated_at && (
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              最終更新: {formatDateJP(detail.seat_updated_at)} ／ {detail.seat_source ?? "—"}
            </div>
          )}
        </div>

        <div className="kpi-grid" style={{ marginTop: 24 }}>
          <Kpi label="Code セッション" value={formatNumber(t.sessions)} />
          <Kpi label="コミット数" value={formatNumber(t.commits)} sub={`PR ${formatNumber(t.prs)}`} />
          <Kpi label="行 +/−" value={`+${formatNumber(t.lines_added)} / −${formatNumber(t.lines_removed)}`} />
          <Kpi label="推定コスト" value={formatUsd(t.cost_cents)} />
        </div>

        <section className="section">
          <header className="section__head">
            <h2 className="section__title">日次推移</h2>
            <div className="section__sub">{detail.range.start} 〜 {detail.range.end} (UTC)</div>
          </header>
          <div className="card">
            <MemberDailyChart data={detail.daily} />
          </div>
        </section>

        <section className="section">
          <header className="section__head">
            <h2 className="section__title">モデル別コスト</h2>
            <div className="section__sub">期間内合計</div>
          </header>
          {detail.models.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>データなし</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th className="num">Input</th>
                    <th className="num">Output</th>
                    <th className="num">Cache read</th>
                    <th className="num">Cache creation</th>
                    <th className="num">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.models.map((m) => (
                    <tr key={m.model}>
                      <td><code style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>{m.model}</code></td>
                      <td className="num">{formatNumber(m.input_tokens)}</td>
                      <td className="num">{formatNumber(m.output_tokens)}</td>
                      <td className="num">{formatNumber(m.cache_read)}</td>
                      <td className="num">{formatNumber(m.cache_creation)}</td>
                      <td className="num">{formatUsd(m.cost_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="section">
          <header className="section__head">
            <h2 className="section__title">ツール accept 率</h2>
            <div className="section__sub">期間内合計</div>
          </header>
          <div className="kpi-grid">
            <ToolKpi label="Edit"     a={t.edit_accepted}          r={t.edit_rejected} />
            <ToolKpi label="MultiEdit" a={t.multi_edit_accepted}    r={t.multi_edit_rejected} />
            <ToolKpi label="Write"    a={t.write_accepted}         r={t.write_rejected} />
            <ToolKpi label="NotebookEdit" a={t.notebook_edit_accepted} r={t.notebook_edit_rejected} />
          </div>
        </section>
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

function ToolKpi({ label, a, r }: { label: string; a: number; r: number }) {
  const total = a + r;
  return (
    <div className="kpi">
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">{acceptRate(a, r)}</div>
      <div className="kpi__sub">{formatNumber(a)} accepted / {formatNumber(total)} proposed</div>
    </div>
  );
}
