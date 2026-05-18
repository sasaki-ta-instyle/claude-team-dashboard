# claude-team-dashboard

Anthropic Claude Team プラン契約者向け、メンバー使用量モニタリング & seat 種別管理ダッシュボード。
管理者が Premium/Standard seat の配分を判断するための数値を 1 画面に集約する。

## 何が取れて何が取れないか（最重要）

Anthropic Team プランの Admin API で取得できる per-member 指標は **Claude Code の日次使用量のみ**。
**Chat (claude.ai UI) と Cowork の per-user 使用量は Team プランでは API でも CSV でも取得できない**
（Enterprise Analytics API 限定）。ダッシュボード上で誤解を生まないよう、Chat/Cowork は「Team プランでは計測不可」と明示する。

| 項目 | Team プランで取れるか |
|---|---|
| Claude Code per-user 日次使用量 | ✅ `usage_report/claude_code` |
| API Messages per-account 使用量 | ✅ `usage_report/messages` |
| 組織メンバー一覧 | ✅ `/v1/organizations/users` |
| Chat / Cowork per-user 使用量 | ❌ Enterprise 限定 |
| 時間別 Claude Code 使用量 | ❌ 日次のみ |

## デプロイ設定（Claude Code 用）

| キー | 値 |
|---|---|
| CATEGORY | `app` |
| APP_NAME | `claude-team-dashboard` |
| PORT | `3007` |
| 公開URL | `https://app.instyle.group/claude-team-dashboard/` |
| HEALTHCHECK_PATH | `/claude-team-dashboard/api/health` |
| USE_DB | `true`（SQLite。マイグレーションはアプリ起動時に自走するため GitHub Actions 側の `pnpm migrate` は呼ばない設定） |
| PM2名 | `app-claude-team-dashboard` |
| サーバ側パス | `/var/www/app/claude-team-dashboard/` |
| SQLite ファイル | `/var/www/app/claude-team-dashboard/shared/data.sqlite`（current 切替で消えない） |
| アプリ固有 env | `/var/www/_shared/apps/app-claude-team-dashboard.env` |

### 必要な env

```bash
# /var/www/_shared/apps/app-claude-team-dashboard.env (chmod 600)
ANTHROPIC_ADMIN_API_KEY=sk-ant-admin01-...        # Console → Admin keys で発行
ADMIN_PASSWORD_HASH='$2a$10$...'                  # bcryptjs で生成（rounds=10）
SESSION_SECRET=...                                # openssl rand -hex 32
DATABASE_PATH=/var/www/app/claude-team-dashboard/shared/data.sqlite
SYNC_LOOKBACK_DAYS=90                              # 初回 sync で何日遡るか
```

## デザインシステム

instyle.group **フラット**デザインシステム（`~/Workspace/design-system/`）に準拠。
詳細は `~/Workspace/design-system/design.md` を参照。

### このプロジェクトでの主要トーン

- カードは `--color-surface` 背景・border なし。ホバーで `--color-surface-2` に1段濃く
- KPI 数値は H2（27px）+ ラベル Small（11px、`--color-text-muted`）
- テーブルは行交互背景で区切る。border は使わない
- ヘッダーロゴは `ig_logo_2026.svg` を `height: 14px` で配置（小さく主張させない）
- ハイライト色 `#E2DD2A` は本文内マーカー専用（CTA・面要素には使わない）
- 警告系（使えていない Premium 等）は `--color-warning` の小さなドット＋短いテキストで表現、面で塗らない

## 共通アセット (favicon / logo / OGP)

`https://app.instyle.group/_shared/static/{favicon.png, logo.svg, ogp.jpg}` で配信。
`app/layout.tsx` の metadata に絶対 URL で指定。

## ローカル開発

```bash
cp .env.example .env.local   # ANTHROPIC_ADMIN_API_KEY と ADMIN_PASSWORD_HASH を埋める
pnpm install
pnpm dev
# http://localhost:3000/claude-team-dashboard/ でアクセス（basePath 込み）
```

### ADMIN_PASSWORD_HASH の生成

```bash
node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
```

生成された `$2a$10$...` を `.env.local` / 本番 env に入れるとき、Next.js の `dotenv-expand` が `$2a` などを変数として展開して hash が壊れるため、各 `$` を `\$` にエスケープすること。

```
ADMIN_PASSWORD_HASH=\$2a\$10\$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

ログイン API 側にも quote 剥がしのフォールバックを入れているが、`$` 展開は防げないため上記のエスケープが必須。

## 本番デプロイ

「本番にあげて」と Claude Code に指示すると、`gh workflow run deploy-prod.yml --ref main` が走り
ConoHa VPS に反映される。SQLite データは `shared/data.sqlite` で永続化されるため、release 切替で消えない。

## 初回 ConoHa セットアップ手順（このアプリ用）

```bash
# 1. アプリディレクトリ + shared 配下の sqlite 用フォルダ
ssh conoha-deploy 'mkdir -p /var/www/app/claude-team-dashboard/{releases,shared} \
  && touch /var/www/_shared/apps/app-claude-team-dashboard.env \
  && chmod 600 /var/www/_shared/apps/app-claude-team-dashboard.env'

# 2. Nginx location（exact + ^~ prefix の 2 段で trailing-slash 308 ループ回避）
ssh conoha-root 'cat > /etc/nginx/conf.d/proxy-apps/app/claude-team-dashboard.conf <<"EOF"
location = /claude-team-dashboard {
  include snippets/proxy-next.conf;
  proxy_pass http://127.0.0.1:3007;
}
location ^~ /claude-team-dashboard/ {
  include snippets/proxy-next.conf;
  proxy_pass http://127.0.0.1:3007;
}
EOF
nginx -t && systemctl reload nginx'

# 3. cron（毎日 03:00 JST に sync を叩く）
ssh conoha-deploy 'crontab -l 2>/dev/null | { cat; echo "0 3 * * * curl -fsS -X POST -H \"X-Sync-Token: \$(grep ^SYNC_TOKEN /var/www/_shared/apps/app-claude-team-dashboard.env | cut -d= -f2)\" http://127.0.0.1:3007/claude-team-dashboard/api/sync >> /var/log/claude-team-dashboard-sync.log 2>&1"; } | crontab -'
```

## 設計メモ

- email を per-user の正本キーにする（Anthropic API が email でしか返さない）
- メンバー一覧 (`/v1/organizations/users`) と使用量を email で join
- seat 種別は SQLite の `member_seat_tag` に管理者が手動でタグ付け（Admin API レスポンスに seat 種別が含まれていることが判明したら自動取得に切り替え）
- 日次 sync は cron で叩く。手動 sync 用 `/admin/sync` も持つ
- 認証は共通パスワード 1 種（管理者全員に配布）。Cookie HttpOnly Secure + JWT 署名

## ロールバック

GitHub Actions 側のヘルスチェック失敗時は自動で前 release に戻る。手動で戻す場合:

```bash
ssh conoha-deploy '
cd /var/www/app/claude-team-dashboard/releases
ls -lt
ln -sfn <previous-sha> ../current.new && mv -T ../current.new ../current
pm2 reload app-claude-team-dashboard --update-env
'
```
