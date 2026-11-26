import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { recentComments, setCommentHidden } from "@/lib/supabase";

export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ comments: await recentComments(true, 200) });
}
export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b?.id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  return NextResponse.json({ ok: await setCommentHidden(String(b.id), !!b.hidden) });
}
