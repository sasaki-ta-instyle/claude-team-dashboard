import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";

// basePath が付いた状態でのパス（middleware は basePath を考慮しない）
// 認証不要なパス
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/health",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /api/sync は X-Sync-Token を持ったリクエスト（cron）も許可するためルート側で個別に判定
  if (pathname === "/api/sync") return NextResponse.next();

  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Next.js の static asset (_next/) と favicon だけ除外し、それ以外は middleware を通す。
// メンバーページが email を path param に持つため `.*\\.` を含む除外パターンを使うとパスが通らなくなる。
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
