import { NextResponse, type NextRequest } from "next/server";
import { runSync } from "@/lib/sync";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

async function authorize(req: NextRequest): Promise<{ ok: boolean; triggeredBy: string }> {
  // 1) Session cookie (logged-in admin)
  const session = await getSession(req);
  if (session) return { ok: true, triggeredBy: "ui:" + session.user };

  // 2) Cron token in header
  const expected = process.env.SYNC_TOKEN;
  if (expected && expected.length > 0) {
    const token = req.headers.get("x-sync-token");
    if (token && token === expected) return { ok: true, triggeredBy: "cron" };
  }

  return { ok: false, triggeredBy: "" };
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const lookbackParam = url.searchParams.get("lookback");
  const lookbackDays = lookbackParam ? Math.max(1, Math.min(365, Number(lookbackParam))) : undefined;

  const result = await runSync({ lookbackDays, triggeredBy: auth.triggeredBy });
  return NextResponse.json(result, { status: result.status === "success" ? 200 : 500 });
}

export async function GET() {
  return NextResponse.json({ hint: "POST to trigger a sync" });
}
