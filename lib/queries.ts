import { getDb, normalizeEmail } from "./db";

export type Period = "day" | "week" | "month";

export function periodToDays(p: Period): number {
  if (p === "day") return 1;
  if (p === "week") return 7;
  return 30;
}

function dateRange(days: number): { start: string; end: string } {
  // 過去 N 日 (UTC) を昨日終わりまで集計
  const today = new Date();
  const endUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  endUtc.setUTCDate(endUtc.getUTCDate() - 1); // 昨日まで
  const start = new Date(endUtc);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { start: start.toISOString().slice(0, 10), end: endUtc.toISOString().slice(0, 10) };
}

export interface MemberRow {
  email: string;
  role: string | null;
  seat: "premium" | "standard" | null;
  seat_source: "anthropic-api" | "manual" | null;
  sessions: number;
  lines_added: number;
  lines_removed: number;
  commits: number;
  prs: number;
  cost_cents: number;
  last_active_date: string | null;
}

export interface DashboardOverview {
  period: Period;
  range: { start: string; end: string };
  members: MemberRow[];
  premiumCount: number;
  standardCount: number;
  activeCount: number;
  totalSessions: number;
  totalCostCents: number;
  lastSyncedAt: string | null;
  underutilizedPremium: MemberRow[];
  premiumCandidates: MemberRow[];
}

export function getOverview(period: Period): DashboardOverview {
  const db = getDb();
  const days = periodToDays(period);
  const { start, end } = dateRange(days);

  const rows = db
    .prepare(
      `SELECT
         om.email AS email,
         om.role  AS role,
         mst.seat AS seat,
         mst.updated_by AS seat_source,
         COALESCE(u.sessions, 0)      AS sessions,
         COALESCE(u.lines_added, 0)   AS lines_added,
         COALESCE(u.lines_removed, 0) AS lines_removed,
         COALESCE(u.commits, 0)       AS commits,
         COALESCE(u.prs, 0)           AS prs,
         COALESCE(u.cost_cents, 0)    AS cost_cents,
         u.last_active_date           AS last_active_date
       FROM org_members om
       LEFT JOIN member_seat_tag mst ON mst.email = om.email
       LEFT JOIN (
         SELECT email,
                SUM(sessions)      AS sessions,
                SUM(lines_added)   AS lines_added,
                SUM(lines_removed) AS lines_removed,
                SUM(commits)       AS commits,
                SUM(prs)           AS prs,
                SUM(cost_cents)    AS cost_cents,
                MAX(date)          AS last_active_date
         FROM code_daily_usage
         WHERE date >= ? AND date <= ?
         GROUP BY email
       ) u ON u.email = om.email
       ORDER BY cost_cents DESC, sessions DESC, email ASC`
    )
    .all(start, end) as MemberRow[];

  // 退会済みなど org_members に居ないが usage が来ているケースのフォールバック
  const orphanRows = db
    .prepare(
      `SELECT
         u.email AS email,
         NULL    AS role,
         mst.seat AS seat,
         mst.updated_by AS seat_source,
         SUM(u.sessions)      AS sessions,
         SUM(u.lines_added)   AS lines_added,
         SUM(u.lines_removed) AS lines_removed,
         SUM(u.commits)       AS commits,
         SUM(u.prs)           AS prs,
         SUM(u.cost_cents)    AS cost_cents,
         MAX(u.date)          AS last_active_date
       FROM code_daily_usage u
       LEFT JOIN member_seat_tag mst ON mst.email = u.email
       WHERE u.date >= ? AND u.date <= ?
         AND u.email NOT IN (SELECT email FROM org_members)
       GROUP BY u.email`
    )
    .all(start, end) as MemberRow[];

  const all = [...rows, ...orphanRows];

  const premiumCount = all.filter((m) => m.seat === "premium").length;
  const standardCount = all.filter((m) => m.seat === "standard").length;
  const activeCount = all.filter((m) => m.sessions > 0).length;
  const totalSessions = all.reduce((acc, m) => acc + m.sessions, 0);
  const totalCostCents = all.reduce((acc, m) => acc + m.cost_cents, 0);

  // 期間内コストの 80 パーセンタイル
  const costs = all.map((m) => m.cost_cents).filter((c) => c > 0).sort((a, b) => a - b);
  const p80 = costs.length > 0 ? costs[Math.floor(costs.length * 0.8)] : 0;

  // Standard 月額換算: 期間が day/week/month で違うので、しきい値を期間に合わせる
  // Standard $25/月 = 2500 cents/月。期間が day なら 2500*(days/30) = 83 cents 相当
  const standardEquivCents = Math.round(2500 * (days / 30));

  const underutilizedPremium = all.filter(
    (m) => m.seat === "premium" && (m.sessions === 0 || m.cost_cents <= standardEquivCents)
  );
  const premiumCandidates = all.filter(
    (m) => m.seat !== "premium" && m.cost_cents > 0 && m.cost_cents >= p80 && p80 > 0
  );

  const lastSync = db
    .prepare(`SELECT ended_at FROM sync_log WHERE status = 'success' ORDER BY id DESC LIMIT 1`)
    .get() as { ended_at: string } | undefined;

  return {
    period,
    range: { start, end },
    members: all,
    premiumCount,
    standardCount,
    activeCount,
    totalSessions,
    totalCostCents,
    lastSyncedAt: lastSync?.ended_at ?? null,
    underutilizedPremium,
    premiumCandidates,
  };
}

export interface MemberDailyPoint {
  date: string;
  sessions: number;
  cost_cents: number;
  lines_added: number;
  lines_removed: number;
  commits: number;
}

export interface MemberModelBreakdown {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  cache_creation: number;
  cost_cents: number;
}

export interface MemberDetail {
  email: string;
  role: string | null;
  seat: "premium" | "standard" | null;
  seat_source: string | null;
  seat_updated_at: string | null;
  period: Period;
  range: { start: string; end: string };
  totals: {
    sessions: number;
    lines_added: number;
    lines_removed: number;
    commits: number;
    prs: number;
    cost_cents: number;
    edit_accepted: number;
    edit_rejected: number;
    multi_edit_accepted: number;
    multi_edit_rejected: number;
    write_accepted: number;
    write_rejected: number;
    notebook_edit_accepted: number;
    notebook_edit_rejected: number;
  };
  daily: MemberDailyPoint[];
  models: MemberModelBreakdown[];
  lastActiveDate: string | null;
  terminalType: string | null;
}

export function getMemberDetail(rawEmail: string, period: Period): MemberDetail | null {
  const db = getDb();
  const email = normalizeEmail(rawEmail);
  const days = periodToDays(period);
  const { start, end } = dateRange(days);

  const member = db
    .prepare(
      `SELECT om.email, om.role, mst.seat, mst.updated_by AS seat_source, mst.updated_at AS seat_updated_at
       FROM org_members om
       LEFT JOIN member_seat_tag mst ON mst.email = om.email
       WHERE om.email = ?`
    )
    .get(email) as { email: string; role: string | null; seat: string | null; seat_source: string | null; seat_updated_at: string | null } | undefined;

  let resolved = member;
  if (!resolved) {
    const usageExists = db.prepare(`SELECT 1 FROM code_daily_usage WHERE email = ? LIMIT 1`).get(email);
    if (!usageExists) return null;
    const tag = db
      .prepare(`SELECT seat, updated_by AS seat_source, updated_at AS seat_updated_at FROM member_seat_tag WHERE email = ?`)
      .get(email) as { seat: string | null; seat_source: string | null; seat_updated_at: string | null } | undefined;
    resolved = {
      email,
      role: null,
      seat: tag?.seat ?? null,
      seat_source: tag?.seat_source ?? null,
      seat_updated_at: tag?.seat_updated_at ?? null,
    };
  }

  const totalsRow = db
    .prepare(
      `SELECT
         COALESCE(SUM(sessions), 0)               AS sessions,
         COALESCE(SUM(lines_added), 0)            AS lines_added,
         COALESCE(SUM(lines_removed), 0)          AS lines_removed,
         COALESCE(SUM(commits), 0)                AS commits,
         COALESCE(SUM(prs), 0)                    AS prs,
         COALESCE(SUM(cost_cents), 0)             AS cost_cents,
         COALESCE(SUM(edit_accepted), 0)          AS edit_accepted,
         COALESCE(SUM(edit_rejected), 0)          AS edit_rejected,
         COALESCE(SUM(multi_edit_accepted), 0)    AS multi_edit_accepted,
         COALESCE(SUM(multi_edit_rejected), 0)    AS multi_edit_rejected,
         COALESCE(SUM(write_accepted), 0)         AS write_accepted,
         COALESCE(SUM(write_rejected), 0)         AS write_rejected,
         COALESCE(SUM(notebook_edit_accepted), 0) AS notebook_edit_accepted,
         COALESCE(SUM(notebook_edit_rejected), 0) AS notebook_edit_rejected,
         MAX(date)                                AS last_active_date,
         MAX(terminal_type)                       AS terminal_type
       FROM code_daily_usage
       WHERE email = ? AND date >= ? AND date <= ?`
    )
    .get(email, start, end) as Record<string, number | string | null>;

  const daily = db
    .prepare(
      `SELECT date, sessions, cost_cents, lines_added, lines_removed, commits
       FROM code_daily_usage
       WHERE email = ? AND date >= ? AND date <= ?
       ORDER BY date ASC`
    )
    .all(email, start, end) as MemberDailyPoint[];

  // 期間内日付を全て埋める（推移グラフ用）
  const dailyMap = new Map(daily.map((d) => [d.date, d]));
  const filled: MemberDailyPoint[] = [];
  const cursor = new Date(start + "T00:00:00Z");
  const endDate = new Date(end + "T00:00:00Z");
  while (cursor.getTime() <= endDate.getTime()) {
    const k = cursor.toISOString().slice(0, 10);
    filled.push(
      dailyMap.get(k) ?? { date: k, sessions: 0, cost_cents: 0, lines_added: 0, lines_removed: 0, commits: 0 }
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const models = db
    .prepare(
      `SELECT model,
              SUM(input_tokens)  AS input_tokens,
              SUM(output_tokens) AS output_tokens,
              SUM(cache_read)    AS cache_read,
              SUM(cache_creation) AS cache_creation,
              SUM(cost_cents)    AS cost_cents
       FROM code_daily_model
       WHERE email = ? AND date >= ? AND date <= ?
       GROUP BY model
       ORDER BY cost_cents DESC`
    )
    .all(email, start, end) as MemberModelBreakdown[];

  return {
    email: resolved.email,
    role: resolved.role,
    seat: (resolved.seat as "premium" | "standard" | null) ?? null,
    seat_source: resolved.seat_source,
    seat_updated_at: resolved.seat_updated_at,
    period,
    range: { start, end },
    totals: {
      sessions: Number(totalsRow.sessions ?? 0),
      lines_added: Number(totalsRow.lines_added ?? 0),
      lines_removed: Number(totalsRow.lines_removed ?? 0),
      commits: Number(totalsRow.commits ?? 0),
      prs: Number(totalsRow.prs ?? 0),
      cost_cents: Number(totalsRow.cost_cents ?? 0),
      edit_accepted: Number(totalsRow.edit_accepted ?? 0),
      edit_rejected: Number(totalsRow.edit_rejected ?? 0),
      multi_edit_accepted: Number(totalsRow.multi_edit_accepted ?? 0),
      multi_edit_rejected: Number(totalsRow.multi_edit_rejected ?? 0),
      write_accepted: Number(totalsRow.write_accepted ?? 0),
      write_rejected: Number(totalsRow.write_rejected ?? 0),
      notebook_edit_accepted: Number(totalsRow.notebook_edit_accepted ?? 0),
      notebook_edit_rejected: Number(totalsRow.notebook_edit_rejected ?? 0),
    },
    daily: filled,
    models,
    lastActiveDate: (totalsRow.last_active_date as string | null) ?? null,
    terminalType: (totalsRow.terminal_type as string | null) ?? null,
  };
}

export interface SyncLogRow {
  id: number;
  started_at: string;
  ended_at: string | null;
  status: "running" | "success" | "error";
  days_processed: number;
  members_synced: number;
  records_upserted: number;
  error_message: string | null;
  triggered_by: string | null;
}

export function getRecentSyncLogs(limit = 20): SyncLogRow[] {
  return getDb()
    .prepare(
      `SELECT id, started_at, ended_at, status, days_processed, members_synced,
              records_upserted, error_message, triggered_by
       FROM sync_log
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(limit) as SyncLogRow[];
}

export function setSeatTag(rawEmail: string, seat: "premium" | "standard", updatedBy = "ui:admin"): void {
  const email = normalizeEmail(rawEmail);
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO member_seat_tag (email, seat, updated_at, updated_by)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         seat = excluded.seat,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by`
    )
    .run(email, seat, now, updatedBy);
}

export function clearSeatTag(rawEmail: string): void {
  const email = normalizeEmail(rawEmail);
  getDb().prepare(`DELETE FROM member_seat_tag WHERE email = ?`).run(email);
}
