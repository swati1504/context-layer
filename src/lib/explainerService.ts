import { fetchArticle } from "./fetchArticle";
import { generateExplainer, type Explainer } from "./explainer";
import { getCachedCard, saveCard } from "./supabase";
import { takeBudget } from "./budget";
import { LimitError } from "./cardService";

const key = (url: string) => "x2:" + url;
const mem = new Map<string, Explainer>();
const inflight = new Map<string, Promise<Explainer>>();
const isX = (c: unknown): c is Explainer => (c as { rev?: number } | null)?.rev === 4 && Array.isArray((c as Explainer).sections);

export async function lookupExplainer(url: string): Promise<Explainer | null> {
  const m = mem.get(url);
  if (m) return m;
  const s = await getCachedCard(key(url));
  if (isX(s)) { mem.set(url, s); return s; }
  return null;
}

export function buildExplainer(url: string): Promise<Explainer> {
  const running = inflight.get(url);
  if (running) return running;
  const p = (async () => {
    if (!takeBudget()) throw new LimitError("limit");
    const x = await generateExplainer(await fetchArticle(url, { withPrimary: true }));
    mem.set(url, x);
    await saveCard(key(url), x);
    return x;
  })().finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}
