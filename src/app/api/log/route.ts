import { NextResponse } from "next/server";
import { insertEvent } from "@/lib/supabase";

const OK = new Set(["page_view", "familiarity_answer", "get_context_click", "skip_click", "card_generated", "card_error", "claim_opened", "section_open", "profile_complete", "simplify_click", "favorite", "share", "report", "limit_modal_view", "limit_modal_cta", "return_visit", "theme_change", "explain_selection", "prompt_shown", "prompt_dismissed", "paste_text_submit", "view_toggle", "ask_question", "explainer_view", "trending_click", "related_click", "comment_post"]);

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b.pid !== "string" || !OK.has(b.event)) return NextResponse.json({ ok: false }, { status: 400 });
  await insertEvent({ pid: b.pid.slice(0, 40), event: b.event, props: b.props && typeof b.props === "object" ? b.props : {} });
  return NextResponse.json({ ok: true });
}
