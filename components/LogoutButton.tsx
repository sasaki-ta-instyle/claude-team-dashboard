"use client";

export function LogoutButton() {
  async function logout() {
    await fetch("/claude-team-dashboard/api/auth/logout", { method: "POST" });
    window.location.assign("/claude-team-dashboard/login");
  }
  return (
    <button className="btn btn--ghost" type="button" onClick={logout}>
      ログアウト
    </button>
  );
}
