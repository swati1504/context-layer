// "This week in tech": three stories, each with what changed and who it affects, built only from verified cards and explainers.
import { getFeed, groupStories } from "./feed";
import { getTrending } from "./trending";
import { buildCard, lookupMany } from "./cardService";
import { buildExplainer, lookupExplainer } from "./explainerService";
import { getCachedCard, saveCard } from "./supabase";
import type { VerifiedCard, Claim2 } from "./card";

export type WeekItem = { url: string; headline: string; changed: Claim2[]; affects: Claim2[]; sources: VerifiedCard["sources"] };
export type Week = { v: 1; weekOf: string; weekEnd: string; items: WeekItem[] };

const ISSUE = 1; // bump to regenerate this week's roundup
function weekRange(d = new Date()) {
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  const end = new Date(+start + 6 * 86400000);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { weekOf: iso(start), weekEnd: iso(end) };
}
const norm = (u: string) => u.replace(/[?#].*$/, "").replace(/\/$/, "");

export async function getWeek(): Promise<Week | null> {
  const { weekOf, weekEnd } = weekRange();
  const key = `week:${weekOf}:${ISSUE}`;
  const hit = (await getCachedCard(key)) as Week | null;
  if (hit?.v === 1 && hit.items?.length) return hit;

  const [feed, trending] = await Promise.all([getFeed().then(groupStories), getTrending().catch(() => [])]);
  const trendSet = new Set(trending.map((t) => norm(t.url)));
  const scored = feed
    .map((s, i) => ({ s, score: s.also.length * 2 + (trendSet.has(norm(s.url)) ? 3 : 0) + Math.max(0, 6 - i) * 0.3 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const cards = await lookupMany(scored.map((x) => x.s.url));
  const picked: { url: string; card: VerifiedCard }[] = [];
  for (const { s } of scored) {
    if (picked.length === 3) break;
    let card = cards[s.url] ?? null;
    if (!card) { try { card = await buildCard(s.url); } catch { continue; } }
    if (card && !picked.some((p) => p.card.tags.some((t) => card!.tags.includes(t)) && p.card.tags[0] === card!.tags[0])) picked.push({ url: s.url, card });
  }
  const items: WeekItem[] = [];
  for (const { url, card } of picked) {
    let ex = await lookupExplainer(url);
    if (!ex) { try { ex = await buildExplainer(url); } catch {} }
    const sec = ex?.sections.find((x) => /who|affect|impact|user|customer/i.test(x.heading) && x.claims.length > 0);
    items.push({ url, headline: card.headline, changed: card.summary.parts ?? [card.summary], affects: sec?.claims.slice(0, 2) ?? [], sources: card.sources });
  }
  if (items.length < 3) return items.length ? ({ v: 1, weekOf, weekEnd, items } as Week) : null;
  const week: Week = { v: 1, weekOf, weekEnd, items };
  await saveCard(key, week);
  return week;
}
