import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import { lookupSource } from "./sources";

export type Article = { url: string; title: string; text: string; sourceName: string; tier: string };

export class FetchError extends Error {
  constructor(public code: "not_approved" | "blocked" | "too_short" | "bad_url", msg: string) {
    super(msg);
  }
}

export async function fetchArticle(url: string): Promise<Article> {
  const src = lookupSource(url);
  if (!src) throw new FetchError("not_approved", "Source is not on the approved list");
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; ContextLayerBot/0.1)", accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!res || !res.ok) throw new FetchError("blocked", `Could not fetch (${res?.status ?? "network"})`);
  // redirects must stay on approved domains
  if (!lookupSource(res.url)) throw new FetchError("not_approved", "Redirected off the approved list");
  const html = await res.text();
  const { document } = parseHTML(html);
  // Readability resolves relative URLs via documentURI; set it so it does not throw
  try { Object.defineProperty(document, "documentURI", { value: res.url }); } catch {}
  const parsed = new Readability(document as unknown as Document).parse();
  const text = (parsed?.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text.length < 800) throw new FetchError("too_short", "Article text too short or paywalled");
  return { url: res.url, title: parsed?.title ?? "", text: text.slice(0, 24000), sourceName: src.name, tier: src.tier };
}

// Paste-text fallback (used when a site blocks fetching)
export function articleFromText(text: string, title = "Pasted text"): Article {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 800) throw new FetchError("too_short", "Pasted text is too short");
  return { url: "", title, text: clean.slice(0, 24000), sourceName: "Pasted text", tier: "pasted" };
}
