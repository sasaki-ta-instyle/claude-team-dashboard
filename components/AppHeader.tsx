import Link from "next/link";
import { LogoutButton } from "./LogoutButton";
import { formatDateJP } from "@/lib/format";

const LOGO_URL = "https://app.instyle.group/_shared/static/logo.svg";

export function AppHeader({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  return (
    <header className="app-header">
      <Link href="/" className="app-header__brand" aria-label="Claude Team Dashboard">
        <img src={LOGO_URL} alt="INSTYLE GROUP" />
        <span className="app-header__brand-text">Claude Team · Usage</span>
      </Link>
      <div className="app-header__meta">
        <span>最終同期 {formatDateJP(lastSyncedAt)}</span>
        <Link href="/admin/sync" className="btn btn--ghost">同期</Link>
        <LogoutButton />
      </div>
    </header>
  );
}
