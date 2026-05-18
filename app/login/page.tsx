import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="login-shell">
      <div className="login-card">
        <h1>Claude Team Dashboard</h1>
        <p>
          管理者用ダッシュボードです。配布された共通パスワードを入力してください。
        </p>
        <LoginForm next={sp.next ?? "/"} />
      </div>
    </main>
  );
}
