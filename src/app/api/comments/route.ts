import { NextResponse } from "next/server";
import { getComment, insertComment, listComments, recentComments, sbEnabled } from "@/lib/supabase";

const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > 5;
}
const pub = ({ id, url, title, parent, name, body, ts }: { id: string; url: string; title: string; parent: string | null; name: string; body: string; ts: string }) => ({ id, url, title, parent, name, body, ts });

// GET ?u=<story url> -> that story's comments. No u -> recent conversations across stories.
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get("u");
  if (u) return NextResponse.json({ comments: (await listComments(u)).map(pub), enabled: sbEnabled, open: !!process.env.DISCUSSION_CODE });
  const all = (await recentComments()).map(pub);
  const byUrl = new Map<string, { url: string; title: string; count: number; latest: ReturnType<typeof pub> }>();
  for (const c of all) {
    const g = byUrl.get(c.url);
    if (g) g.count++;
    else byUrl.set(c.url, { url: c.url, title: c.title, count: 1, latest: c });
  }
  return NextResponse.json({ threads: [...byUrl.values()].slice(0, 20), enabled: sbEnabled });
}

export async function POST(req: Request) {
  const code = process.env.DISCUSSION_CODE;
  if (!sbEnabled || !code) return NextResponse.json({ error: "closed" }, { status: 503 });
  const b = await req.json().catch(() => null);
  const url = String(b?.url ?? "").slice(0, 600);
  const title = String(b?.title ?? "").slice(0, 200);
  const name = String(b?.name ?? "").replace(/\s+/g, " ").trim();
  const body = String(b?.body ?? "").replace(/\s+/g, " ").trim();
  const parent = b?.parent ? String(b.parent) : null;
  if (String(b?.code ?? "").trim() !== code) return NextResponse.json({ error: "bad_code" }, { status: 401 });
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (name.length < 2 || name.length > 24) return NextResponse.json({ error: "bad_name" }, { status: 400 });
  if (body.length < 2 || body.length > 280) return NextResponse.json({ error: "bad_body" }, { status: 400 });
  if (/https?:|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|ai|app|ly|xyz)\b/i.test(body + " " + name)) return NextResponse.json({ error: "no_links" }, { status: 400 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip + "|" + name.toLowerCase())) return NextResponse.json({ error: "slow_down" }, { status: 429 });
  if (parent) {
    const p = await getComment(parent);
    if (!p || p.url !== url || p.parent) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const saved = await insertComment({ url, title, parent, name, body });
  if (!saved) return NextResponse.json({ error: "server" }, { status: 500 });
  return NextResponse.json({ comment: pub(saved) });
}
