import { getDb, normalizeEmail } from "./db";
import { fetchAllMembers, fetchClaudeCodeUsage } from "./anthropic-admin";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function* lastNDays(n: number): IterableIterator<string> {
  // 今日（UTC）は API のデータ遅延（1h）で空かもしれないが、cron が JST 03:00 = UTC 18:00 前日なので問題ない。
  // 念のため「昨日 = UTC today-1d」から N 日分を遡る。
  const now = new Date();
  const startUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let i = 1; i <= n; i++) {
    const d = new Date(startUtc);
    d.setUTCDate(d.getUTCDate() - i);
    yield isoDate(d);
  }
}

export interface SyncResult {
  startedAt: string;
  endedAt: string;
  status: "success" | "error";
  daysProcessed: number;
  membersSynced: number;
  recordsUpserted: number;
  errorMessage?: string;
}

export async function runSync(opts: { lookbackDays?: number; triggeredBy?: string } = {}): Promise<SyncResult> {
  const db = getDb();
  const lookbackDays = opts.lookbackDays ?? Number(process.env.SYNC_LOOKBACK_DAYS ?? 90);
  const startedAt = new Date().toISOString();

  const logInsert = db.prepare(
    `INSERT INTO sync_log (started_at, status, triggered_by) VALUES (?, 'running', ?)`
  );
  const info = logInsert.run(startedAt, opts.triggeredBy ?? "manual");
  const logId = info.lastInsertRowid as number;

  let daysProcessed = 0;
  let recordsUpserted = 0;
  let membersSynced = 0;

  try {
    // 1) members
    const members = await fetchAllMembers();
    membersSynced = members.length;
    const upsertMember = db.prepare(
      `INSERT INTO org_members (email, role, added_at, last_synced_at)
       VALUES (@email, @role, @added_at, @last_synced_at)
       ON CONFLICT(email) DO UPDATE SET
         role = excluded.role,
         added_at = COALESCE(excluded.added_at, org_members.added_at),
         last_synced_at = excluded.last_synced_at`
    );
    const upsertSeatFromApi = db.prepare(
      `INSERT INTO member_seat_tag (email, seat, updated_at, updated_by)
       VALUES (@email, @seat, @updated_at, 'anthropic-api')
       ON CONFLICT(email) DO UPDATE SET
         seat = excluded.seat,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by
       WHERE member_seat_tag.updated_by = 'anthropic-api' OR member_seat_tag.updated_by IS NULL`
    );
    const now = new Date().toISOString();
    const memberTx = db.transaction(() => {
      for (const m of members) {
        const email = normalizeEmail(m.email);
        upsertMember.run({ email, role: m.role ?? null, added_at: m.added_at ?? null, last_synced_at: now });
        if (m.seat) {
          upsertSeatFromApi.run({ email, seat: m.seat, updated_at: now });
        }
      }
    });
    memberTx();

    // 2) claude_code usage for last N days
    const upsertUsage = db.prepare(
      `INSERT INTO code_daily_usage (
         date, email, sessions, lines_added, lines_removed, commits, prs,
         edit_accepted, edit_rejected, multi_edit_accepted, multi_edit_rejected,
         write_accepted, write_rejected, notebook_edit_accepted, notebook_edit_rejected,
         input_tokens, output_tokens, cache_read, cache_creation, cost_cents,
         terminal_type, subscription_type
       ) VALUES (
         @date, @email, @sessions, @lines_added, @lines_removed, @commits, @prs,
         @edit_accepted, @edit_rejected, @multi_edit_accepted, @multi_edit_rejected,
         @write_accepted, @write_rejected, @notebook_edit_accepted, @notebook_edit_rejected,
         @input_tokens, @output_tokens, @cache_read, @cache_creation, @cost_cents,
         @terminal_type, @subscription_type
       )
       ON CONFLICT(date, email) DO UPDATE SET
         sessions = excluded.sessions,
         lines_added = excluded.lines_added,
         lines_removed = excluded.lines_removed,
         commits = excluded.commits,
         prs = excluded.prs,
         edit_accepted = excluded.edit_accepted,
         edit_rejected = excluded.edit_rejected,
         multi_edit_accepted = excluded.multi_edit_accepted,
         multi_edit_rejected = excluded.multi_edit_rejected,
         write_accepted = excluded.write_accepted,
         write_rejected = excluded.write_rejected,
         notebook_edit_accepted = excluded.notebook_edit_accepted,
         notebook_edit_rejected = excluded.notebook_edit_rejected,
         input_tokens = excluded.input_tokens,
         output_tokens = excluded.output_tokens,
         cache_read = excluded.cache_read,
         cache_creation = excluded.cache_creation,
         cost_cents = excluded.cost_cents,
         terminal_type = COALESCE(excluded.terminal_type, code_daily_usage.terminal_type),
         subscription_type = COALESCE(excluded.subscription_type, code_daily_usage.subscription_type)`
    );

    const upsertModel = db.prepare(
      `INSERT INTO code_daily_model (
         date, email, model, input_tokens, output_tokens, cache_read, cache_creation, cost_cents
       ) VALUES (
         @date, @email, @model, @input_tokens, @output_tokens, @cache_read, @cache_creation, @cost_cents
       )
       ON CONFLICT(date, email, model) DO UPDATE SET
         input_tokens = excluded.input_tokens,
         output_tokens = excluded.output_tokens,
         cache_read = excluded.cache_read,
         cache_creation = excluded.cache_creation,
         cost_cents = excluded.cost_cents`
    );

    const deleteOldModelsForDate = db.prepare(
      `DELETE FROM code_daily_model WHERE date = ? AND email = ?`
    );

    for (const date of lastNDays(lookbackDays)) {
      const records = await fetchClaudeCodeUsage(date);
      const tx = db.transaction(() => {
        for (const rec of records) {
          if (rec.actor.type !== "user_actor" || !rec.actor.email_address) continue;
          const email = normalizeEmail(rec.actor.email_address);
          const t = rec.tool_actions || {};
          const totalTokens = (rec.model_breakdown || []).reduce(
            (acc, m) => {
              acc.input += m.tokens.input;
              acc.output += m.tokens.output;
              acc.cache_read += m.tokens.cache_read;
              acc.cache_creation += m.tokens.cache_creation;
              acc.cost += m.estimated_cost?.amount ?? 0;
              return acc;
            },
            { input: 0, output: 0, cache_read: 0, cache_creation: 0, cost: 0 }
          );
          upsertUsage.run({
            date: rec.date.slice(0, 10),
            email,
            sessions: rec.core_metrics?.num_sessions ?? 0,
            lines_added: rec.core_metrics?.lines_of_code?.added ?? 0,
            lines_removed: rec.core_metrics?.lines_of_code?.removed ?? 0,
            commits: rec.core_metrics?.commits_by_claude_code ?? 0,
            prs: rec.core_metrics?.pull_requests_by_claude_code ?? 0,
            edit_accepted: t.edit_tool?.accepted ?? 0,
            edit_rejected: t.edit_tool?.rejected ?? 0,
            multi_edit_accepted: t.multi_edit_tool?.accepted ?? 0,
            multi_edit_rejected: t.multi_edit_tool?.rejected ?? 0,
            write_accepted: t.write_tool?.accepted ?? 0,
            write_rejected: t.write_tool?.rejected ?? 0,
            notebook_edit_accepted: t.notebook_edit_tool?.accepted ?? 0,
            notebook_edit_rejected: t.notebook_edit_tool?.rejected ?? 0,
            input_tokens: totalTokens.input,
            output_tokens: totalTokens.output,
            cache_read: totalTokens.cache_read,
            cache_creation: totalTokens.cache_creation,
            cost_cents: totalTokens.cost,
            terminal_type: rec.terminal_type ?? null,
            subscription_type: rec.subscription_type ?? null,
          });
          deleteOldModelsForDate.run(rec.date.slice(0, 10), email);
          for (const m of rec.model_breakdown || []) {
            upsertModel.run({
              date: rec.date.slice(0, 10),
              email,
              model: m.model,
              input_tokens: m.tokens.input,
              output_tokens: m.tokens.output,
              cache_read: m.tokens.cache_read,
              cache_creation: m.tokens.cache_creation,
              cost_cents: m.estimated_cost?.amount ?? 0,
            });
          }
          recordsUpserted++;
        }
      });
      tx();
      daysProcessed++;
    }

    const endedAt = new Date().toISOString();
    db.prepare(
      `UPDATE sync_log SET ended_at = ?, status = 'success',
         days_processed = ?, members_synced = ?, records_upserted = ?
       WHERE id = ?`
    ).run(endedAt, daysProcessed, membersSynced, recordsUpserted, logId);

    return {
      startedAt,
      endedAt,
      status: "success",
      daysProcessed,
      membersSynced,
      recordsUpserted,
    };
  } catch (err) {
    const endedAt = new Date().toISOString();
    const msg = err instanceof Error ? err.message : String(err);
    db.prepare(
      `UPDATE sync_log SET ended_at = ?, status = 'error',
         days_processed = ?, members_synced = ?, records_upserted = ?, error_message = ?
       WHERE id = ?`
    ).run(endedAt, daysProcessed, membersSynced, recordsUpserted, msg.slice(0, 1000), logId);
    return {
      startedAt,
      endedAt,
      status: "error",
      daysProcessed,
      membersSynced,
      recordsUpserted,
      errorMessage: msg,
    };
  }
}
