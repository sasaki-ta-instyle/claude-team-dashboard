import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let password: string | undefined;
  try {
    const body = (await req.json()) as { password?: string };
    password = body.password;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "password_required" }, { status: 400 });
  }

  let hash = process.env.ADMIN_PASSWORD_HASH ?? "";
  // .env パーサが quote を剥がさず取り込んでしまった場合の保険
  if (
    (hash.startsWith("'") && hash.endsWith("'")) ||
    (hash.startsWith('"') && hash.endsWith('"'))
  ) {
    hash = hash.slice(1, -1);
  }
  if (!hash) {
    return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  }

  const ok = await bcrypt.compare(password, hash);
  if (!ok) {
    // 軽い遅延でブルートフォースを抑制
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  const token = await createSessionToken("admin");
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, token);
  return res;
}
