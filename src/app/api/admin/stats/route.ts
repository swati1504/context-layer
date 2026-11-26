import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { listEvents, listReports, sbEnabled } from "@/lib/supabase";

export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const all = await listEvents();
  // pids starting with s_test or s_demo are rehearsal runs and are ignored in the results
  const study = all.filter((e) => e.props?.study === true && !/^s_(test|demo)/.test(e.pid));
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
  // ---- main app (everyone who is not a study participant, a rehearsal id or marked internal) ----
  type E = (typeof all)[number];
  const app = all.filter((e) => e.props?.study !== true && e.props?.internal !== true && !/^s_/.test(e.pid));
  const by = (ev: string) => app.filter((e) => e.event === ev);
  const pidsApp = new Set(app.map((e) => e.pid));
  const str = (v: unknown) => String(v ?? "");
  const openedKey = new Set([...by("get_context_click"), ...by("read_story_click")].map((e) => e.pid + "|" + str(e.props.url)));
  const consideredKey = new Set([...by("preview_considered").map((e) => e.pid + "|" + str(e.props.url)), ...openedKey]);
  const passedKey = [...consideredKey].filter((k) => !openedKey.has(k));
  const dwellMax = new Map<string, number>();
  for (const e of by("preview_dwell")) { const k = e.pid + "|" + str(e.props.url); dwellMax.set(k, Math.max(dwellMax.get(k) ?? 0, Number(e.props.ms) || 0)); }
  const storyRows: Record<string, { considered: number; opened: number }> = {};
  for (const k of consideredKey) { const u = k.slice(k.indexOf("|") + 1); const r = (storyRows[u] ??= { considered: 0, opened: 0 }); r.considered++; if (openedKey.has(k)) r.opened++; }
  const reads = by("page_leave").filter((e) => e.props.path === "/story");
  const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
  const hosts: Record<string, number> = {};
  for (const e of by("outbound_click")) hosts[str(e.props.host)] = (hosts[str(e.props.host)] ?? 0) + 1;
  const devices: Record<string, number> = {};
  for (const e of by("visitor_new")) devices[str(e.props.device)] = (devices[str(e.props.device)] ?? 0) + 1;
  const errs: Record<string, number> = {};
  for (const e of by("client_error")) errs[str(e.props.message)] = (errs[str(e.props.message)] ?? 0) + 1;
  const visitors = [...pidsApp].map((pid) => {
    const ev = app.filter((e: E) => e.pid === pid);
    const ts = ev.map((e) => +new Date(e.ts));
    const mine = (k: Set<string>) => [...k].filter((x) => x.startsWith(pid + "|")).length;
    return {
      pid, first: new Date(Math.min(...ts)).toISOString(), last: new Date(Math.max(...ts)).toISOString(),
      device: str(ev.find((e) => e.event === "visitor_new" || e.event === "session_start")?.props.device),
      events: ev.length, considered: mine(consideredKey), opened: mine(openedKey),
      read_s: Math.round(ev.filter((e) => e.event === "page_leave" && e.props.path === "/story").reduce((a, e) => a + (Number(e.props.ms) || 0), 0) / 1000),
      questions: ev.filter((e) => e.event === "ask_question").length,
    };
  }).sort((a, b) => b.last.localeCompare(a.last)).slice(0, 60);
  const appStats = {
    visitors: pidsApp.size, new_visitors: by("visitor_new").length, sessions: by("session_start").length,
    returning_visitors: new Set(by("return_visit").map((e) => e.pid)).size, devices,
    previews_considered: consideredKey.size, opened_context: openedKey.size, passed: passedKey.length,
    open_rate: consideredKey.size ? Math.round((100 * [...consideredKey].filter((k) => openedKey.has(k)).length) / consideredKey.size) : null,
    avg_preview_s_passed: passedKey.length ? Math.round(passedKey.reduce((a, k) => a + (dwellMax.get(k) ?? 3000), 0) / passedKey.length / 100) / 10 : null,
    story_reads: reads.length, median_read_s: med(reads.map((e) => Number(e.props.ms) / 1000)), read_to_end_pct: reads.length ? Math.round((100 * reads.filter((e) => Number(e.props.depth) >= 75).length) / reads.length) : null,
    outbound_clicks: by("outbound_click").length, outbound_hosts: hosts,
    questions: by("ask_question").length, highlights: by("explain_selection").length, saves: by("favorite").length, shares: by("share").length, passages_opened: by("claim_opened").length,
    screenshots: by("screenshot_submit").length, errors: errs,
    top_stories: Object.entries(storyRows).sort((a, b) => b[1].considered - a[1].considered).slice(0, 15).map(([url, r]) => ({ url, ...r })),
    visitor_list: visitors,
  };
  return NextResponse.json({
    app: appStats,
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
