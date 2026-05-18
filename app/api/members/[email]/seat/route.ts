import { NextResponse, type NextRequest } from "next/server";
import { setSeatTag, clearSeatTag } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail);
  let seat: unknown;
  try {
    const body = (await req.json()) as { seat?: unknown };
    seat = body.seat;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (seat === null || seat === "" || typeof seat === "undefined") {
    clearSeatTag(email);
    return NextResponse.json({ ok: true, seat: null });
  }
  if (seat !== "premium" && seat !== "standard") {
    return NextResponse.json({ error: "invalid_seat" }, { status: 400 });
  }
  setSeatTag(email, seat as "premium" | "standard");
  return NextResponse.json({ ok: true, seat });
}
