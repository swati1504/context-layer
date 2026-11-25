import { NextResponse } from "next/server";
import { insertReport } from "@/lib/supabase";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b.claim !== "string" || typeof b.reason !== "string") return NextResponse.json({ ok: false }, { status: 400 });
  await insertReport({ url: String(b.url ?? "").slice(0, 500), claim: b.claim.slice(0, 600), reason: b.reason.slice(0, 80), pid: String(b.pid ?? "").slice(0, 40) });
  return NextResponse.json({ ok: true });
}
