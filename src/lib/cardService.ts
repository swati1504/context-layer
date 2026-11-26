import { fetchArticle, articleFromText } from "./fetchArticle";
import { generateCard, type VerifiedCard } from "./card";
import { getCachedCard, getCachedCards, saveCard } from "./supabase";
import { takeBudget } from "./budget";

const mem = new Map<string, VerifiedCard>();
const inflight = new Map<string, Promise<VerifiedCard>>();
const isV2 = (c: unknown): c is VerifiedCard => (c as { v?: number; rev?: number } | null)?.rev === 6;

export async function lookupCard(url: string): Promise<VerifiedCard | null> {
  const m = mem.get(url);
  if (m) return m;
  const s = await getCachedCard(url);
  if (isV2(s)) { mem.set(url, s); return s; }
  return null;
}
export async function lookupMany(urls: string[]): Promise<Record<string, VerifiedCard>> {
  const out: Record<string, VerifiedCard> = {};
  const miss: string[] = [];
  for (const u of urls) { const m = mem.get(u); if (m) out[u] = m; else miss.push(u); }
  const got = await getCachedCards(miss);
  for (const [u, c] of Object.entries(got)) if (isV2(c)) { mem.set(u, c); out[u] = c; }
  return out;
}

export class LimitError extends Error {}

// Build (once at a time per url) and store a card for a public link.
export function buildCard(url: string): Promise<VerifiedCard> {
  const running = inflight.get(url);
  if (running) return running;
  const p = (async () => {
    if (!takeBudget()) throw new LimitError("limit");
    const card = await generateCard(await fetchArticle(url, { withPrimary: true }));
    mem.set(url, card);
    await saveCard(url, card);
    return card;
  })().finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

export async function buildFromText(text: string, title: string, sourceName?: string, min?: number): Promise<VerifiedCard> {
  if (!takeBudget()) throw new LimitError("limit");
  return generateCard(articleFromText(text, title, sourceName, min));
}
