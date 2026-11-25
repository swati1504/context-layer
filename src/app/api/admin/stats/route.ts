import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { listEvents, listReports, sbEnabled } from "@/lib/supabase";

export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const all = await listEvents();
  const study = all.filter((e) => e.props?.study === true);
  const pids = new Set(study.map((e) => e.pid));
  const count = (ev: string) => study.filter((e) => e.event === ev).length;
  const fam: Record<string, number> = {};
  for (const e of study.filter((e) => e.event === "familiarity_answer")) fam[String(e.props.answer)] = (fam[String(e.props.answer)] ?? 0) + 1;
  // per participant: did they choose context at least once on a story they did not fully understand?
  const per: Record<string, { ctx: number; skip: number; unfamiliar: number }> = {};
  for (const e of study) {
    const p = (per[e.pid] ??= { ctx: 0, skip: 0, unfamiliar: 0 });
    if (e.event === "get_context_click") p.ctx++;
    if (e.event === "skip_click") p.skip++;
    if (e.event === "familiarity_answer" && e.props.answer !== "understand") p.unfamiliar++;
  }
  const ctxChoice = count("get_context_click"), skipChoice = count("skip_click");
  return NextResponse.json({
    supabase: sbEnabled,
    participants: pids.size,
    familiarity: fam,
    get_context_clicks: ctxChoice,
    skips: skipChoice,
    context_rate: ctxChoice + skipChoice ? Math.round((100 * ctxChoice) / (ctxChoice + skipChoice)) : null,
    participants_who_chose_context: Object.values(per).filter((p) => p.ctx > 0).length,
    cards_generated: count("card_generated"),
    claims_opened: count("claim_opened"),
    simplify_clicks: count("simplify_click"),
    profile_completed: count("profile_complete"),
    returned: count("return_visit"),
    reports: (await listReports()).slice(0, 50),
    total_events: all.length,
  });
}
