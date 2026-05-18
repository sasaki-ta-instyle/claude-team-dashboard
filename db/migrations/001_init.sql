-- Anthropic Team プラン使用量モニタリング 初期スキーマ
-- 全テーブル: email は小文字に normalize したものを保存する。

CREATE TABLE IF NOT EXISTS org_members (
  email             TEXT PRIMARY KEY,
  role              TEXT,
  added_at          TEXT,
  last_synced_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS member_seat_tag (
  email             TEXT PRIMARY KEY,
  seat              TEXT NOT NULL CHECK (seat IN ('premium','standard')),
  updated_at        TEXT NOT NULL,
  updated_by        TEXT
);

CREATE TABLE IF NOT EXISTS code_daily_usage (
  date              TEXT NOT NULL,        -- YYYY-MM-DD (UTC)
  email             TEXT NOT NULL,
  sessions          INTEGER NOT NULL DEFAULT 0,
  lines_added       INTEGER NOT NULL DEFAULT 0,
  lines_removed     INTEGER NOT NULL DEFAULT 0,
  commits           INTEGER NOT NULL DEFAULT 0,
  prs               INTEGER NOT NULL DEFAULT 0,
  edit_accepted     INTEGER NOT NULL DEFAULT 0,
  edit_rejected     INTEGER NOT NULL DEFAULT 0,
  multi_edit_accepted    INTEGER NOT NULL DEFAULT 0,
  multi_edit_rejected    INTEGER NOT NULL DEFAULT 0,
  write_accepted    INTEGER NOT NULL DEFAULT 0,
  write_rejected    INTEGER NOT NULL DEFAULT 0,
  notebook_edit_accepted INTEGER NOT NULL DEFAULT 0,
  notebook_edit_rejected INTEGER NOT NULL DEFAULT 0,
  input_tokens      INTEGER NOT NULL DEFAULT 0,
  output_tokens     INTEGER NOT NULL DEFAULT 0,
  cache_read        INTEGER NOT NULL DEFAULT 0,
  cache_creation    INTEGER NOT NULL DEFAULT 0,
  cost_cents        INTEGER NOT NULL DEFAULT 0,
  terminal_type     TEXT,
  subscription_type TEXT,
  PRIMARY KEY (date, email)
);

CREATE INDEX IF NOT EXISTS idx_code_daily_usage_email ON code_daily_usage(email);
CREATE INDEX IF NOT EXISTS idx_code_daily_usage_date  ON code_daily_usage(date);

CREATE TABLE IF NOT EXISTS code_daily_model (
  date              TEXT NOT NULL,
  email             TEXT NOT NULL,
  model             TEXT NOT NULL,
  input_tokens      INTEGER NOT NULL DEFAULT 0,
  output_tokens     INTEGER NOT NULL DEFAULT 0,
  cache_read        INTEGER NOT NULL DEFAULT 0,
  cache_creation    INTEGER NOT NULL DEFAULT 0,
  cost_cents        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, email, model)
);

CREATE INDEX IF NOT EXISTS idx_code_daily_model_email ON code_daily_model(email);

-- 将来 Chat/Cowork の CSV を取り込むための汎用テーブル（MVP では未使用）
CREATE TABLE IF NOT EXISTS member_external_usage (
  date              TEXT NOT NULL,
  email             TEXT NOT NULL,
  surface           TEXT NOT NULL CHECK (surface IN ('chat','cowork')),
  metric            TEXT NOT NULL,
  value             REAL NOT NULL,
  source            TEXT,
  PRIMARY KEY (date, email, surface, metric)
);

CREATE TABLE IF NOT EXISTS sync_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at        TEXT NOT NULL,
  ended_at          TEXT,
  status            TEXT NOT NULL CHECK (status IN ('running','success','error')),
  days_processed    INTEGER NOT NULL DEFAULT 0,
  members_synced    INTEGER NOT NULL DEFAULT 0,
  records_upserted  INTEGER NOT NULL DEFAULT 0,
  error_message     TEXT,
  triggered_by      TEXT
);

CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
