# claude-team-dashboard 再開手順

このドキュメントは、Claude Code セッションを終了したり別の Mac に切り替えた後で、
`claude-team-dashboard` の開発・運用作業をスムーズに再開するためのチェックリスト。

> **更新ルール:** このファイルを変更したら必ず main に push して、別 Mac / 別メンバーが
> 最新を取れる状態に保つ。秘密値そのものは絶対に書かない（取得元のリンクのみ）。

---

## 0. このアプリの基本情報

| 項目 | 値 |
|---|---|
| 公開 URL | `https://app.instyle.group/claude-team-dashboard/` |
| GitHub | `https://github.com/sasaki-ta-instyle/claude-team-dashboard` |
| ConoHa デプロイ先 | `/var/www/app/claude-team-dashboard/` |
| 共有 env | `/var/www/_shared/apps/app-claude-team-dashboard.env`（chmod 600） |
| PM2 名 | `app-claude-team-dashboard` |
| ポート | `3007` |
| Healthcheck | `/claude-team-dashboard/api/health` |
| USE_DB | `true`（SQLite、`shared/data.sqlite`） |

---

## 1. 同じ Mac で再開する

```bash
cd ~/Workspace/claude-team-dashboard
claude
```

`CLAUDE.md` を参照させると設計判断・スコープが取り戻せる。

---

## 2. 別の Mac で再開する

### 2.1 ソースコードを取得

```bash
gh repo clone sasaki-ta-instyle/claude-team-dashboard ~/Workspace/claude-team-dashboard
cd ~/Workspace/claude-team-dashboard
pnpm install
```

### 2.2 `.env.local` を配置（git 管理外）

`~/Workspace/claude-team-dashboard/.env.local`:

```
ANTHROPIC_ADMIN_API_KEY=sk-ant-admin01-...
ADMIN_PASSWORD_HASH='$2a$10$...'
SESSION_SECRET=...
DATABASE_PATH=./data/data.sqlite
SYNC_LOOKBACK_DAYS=90
```

| キー | 取得元 |
|---|---|
| `ANTHROPIC_ADMIN_API_KEY` | https://console.anthropic.com/settings/admin-keys（admin 権限で発行） |
| `ADMIN_PASSWORD_HASH` | bcryptjs で生成: `node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"`。**注意**: 生成された `$2a$10$...` の `$` は `.env.local` では `\$` にエスケープすること（dotenv-expand が変数展開して hash が壊れる） |
| `SESSION_SECRET` | `openssl rand -hex 32` |

### 2.3 起動

```bash
mkdir -p data   # ローカル SQLite ファイル用（.gitignore 済み）
pnpm dev
# → http://localhost:3000/claude-team-dashboard/
```

初回起動時にマイグレーションが自走し、`data/data.sqlite` が作成される。
`/admin/sync` を開いて手動 sync を実行すると API からデータが入る。

---

## 3. データ・状態の永続化マッピング

| 種類 | 場所 | 引き継ぎ方法 |
|---|---|---|
| ソースコード | GitHub `sasaki-ta-instyle/claude-team-dashboard` | `git clone` |
| 本番 SQLite | ConoHa `/var/www/app/claude-team-dashboard/shared/data.sqlite` | サーバ側永続、release 切替で消えない |
| 本番 env | ConoHa `/var/www/_shared/apps/app-claude-team-dashboard.env` | サーバ側永続 |
| Admin API キー | Anthropic Console の Admin keys ページ | 再発行可（取り消し→再生成） |
| ローカル SQLite | `./data/data.sqlite` | dev 用、同期しない |

---

## 4. よくある運用コマンド

### 本番デプロイ

```bash
gh workflow run deploy-prod.yml --ref main -R sasaki-ta-instyle/claude-team-dashboard
gh run watch -R sasaki-ta-instyle/claude-team-dashboard
```

### 手動 sync（本番）

```bash
ssh conoha-deploy 'curl -fsS -X POST -H "X-Sync-Token: $(grep ^SYNC_TOKEN /var/www/_shared/apps/app-claude-team-dashboard.env | cut -d= -f2)" http://127.0.0.1:3007/claude-team-dashboard/api/sync'
```

### 本番 PM2 ログ

```bash
ssh conoha-deploy 'pm2 logs app-claude-team-dashboard --nostream --lines 50 --raw'
```

### 本番 SQLite を覗く

```bash
ssh conoha-deploy 'sqlite3 /var/www/app/claude-team-dashboard/shared/data.sqlite ".tables"'
```

---

## 5. 残タスク / 未実装の挙動

| # | 内容 | 状態 |
|---|---|---|
| 1 | Admin API レスポンスに seat 種別が含まれるかの検証 → 含まれていれば手動タグを自動取得に切り替え | 未検証 |
| 2 | Chat / Cowork CSV アップロード UI（将来 CSV が手で取れるようになったとき用） | 未着手 |
| 3 | Slack 通知（sync 失敗時） | 未着手 |

---

## 6. 緊急時の参考

- ConoHa 本番運用 runbook: `~/Workspace/docs/conoha-setup.md`
- ポート台帳: `~/Workspace/docs/conoha-port-registry.md`
- Anthropic Admin API: https://platform.claude.com/docs/en/manage-claude/admin-api
- Claude Code Analytics API: https://platform.claude.com/docs/en/build-with-claude/claude-code-analytics-api
