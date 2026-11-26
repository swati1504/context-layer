import { isAdmin } from "@/lib/admin";
import { listEvents } from "@/lib/supabase";

// All logged events as CSV, one row per event, for analysis in a spreadsheet.
export async function GET(req: Request) {
  if (!isAdmin(req)) return new Response("unauthorized", { status: 401 });
  const all = await listEvents();
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = ["ts,pid,event,props", ...all.map((e) => [e.ts, e.pid, e.event, JSON.stringify(e.props)].map(q).join(","))];
  return new Response(rows.join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=context-layer-events.csv" } });
}
