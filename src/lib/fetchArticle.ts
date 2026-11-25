import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { lookupSource } from "./sources";

export type Source = { kind: "primary" | "reporting"; name: string; url: string; approved: boolean; title: string; text: string };
export type Article = {
  url: string;
  title: string;
  text: string;
  sourceName: string;
  tier: string;
  approved: boolean;
  primary?: Source; // the company's own announcement, when the article links to one
};

export class FetchError extends Error {
  constructor(public code: "blocked" | "too_short" | "bad_url", msg: string) {
    super(msg);
  }
}

// ---- SSRF guard: only public http(s) hosts, checked on every redirect hop ----
function privateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
}
async function assertPublic(u: URL) {
  if (!/^https?:$/.test(u.protocol)) throw new FetchError("bad_url", "Only web links are supported");
  if (u.port && !["80", "443"].includes(u.port)) throw new FetchError("bad_url", "Unsupported port");
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new FetchError("bad_url", "Not a public site");
  const ips = net.isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (ips.length === 0 || ips.some(privateIp)) throw new FetchError("bad_url", "Not a public site");
}
async function safeFetch(url: string): Promise<Response | null> {
  let cur = url;
  for (let hop = 0; hop < 5; hop++) {
    const u = new URL(cur);
    await assertPublic(u);
    const res = await fetch(cur, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ContextLayerBot/0.1)", accept: "text/html,application/xhtml+xml" },
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    if (!res) return null;
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { cur = new URL(res.headers.get("location")!, cur).toString(); continue; }
    return res;
  }
  return null;
}

async function readPage(url: string) {
  let u: URL;
  try { u = new URL(url); } catch { throw new FetchError("bad_url", "That does not look like a link"); }
  const res = await safeFetch(u.toString());
  if (!res || !res.ok) throw new FetchError("blocked", `Could not fetch (${res?.status ?? "network"})`);
  const ct = res.headers.get("content-type") ?? "";
  if (!/html|xml/i.test(ct)) throw new FetchError("bad_url", "That link is not a web page");
  const html = (await res.text()).slice(0, 3_000_000);
  const { document } = parseHTML(html);
  try { Object.defineProperty(document, "documentURI", { value: res.url || u.toString() }); } catch {}
  // Readability can cut an article short (for example after a pull quote), so also read the <article> paragraphs directly.
  let direct = "";
  try {
    const root = document.querySelector("article") ?? document.querySelector("[itemprop=articleBody]") ?? document.querySelector("main");
    if (root) {
      const parts: string[] = [];
      root.querySelectorAll("p, blockquote, h2, h3, li").forEach((el: Element) => {
        if (el.closest("aside, nav, footer, form, figure, [class*=related], [class*=comment], [class*=share], [class*=newsletter]")) return;
        if (el.tagName === "LI" && el.closest("blockquote")) return;
        if (el.tagName === "P" && el.closest("blockquote")) return;
        const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
        if (t.length > 20) parts.push(t);
      });
      direct = parts.join(" ");
    }
  } catch {}
  const parsed = new Readability(document as unknown as Document).parse();
  const rText = (parsed?.textContent ?? "").replace(/\s+/g, " ").trim();
  const text = direct.length > rText.length * 1.3 && direct.length > 800 ? direct : rText;
  if (text.length < 800) throw new FetchError("too_short", "Article text too short or paywalled");
  const finalUrl = res.url || u.toString();
  return { finalUrl, title: parsed?.title ?? "", text: text.slice(0, 24000), contentHtml: parsed?.content ?? "" };
}

// Find the company's own announcement among the links inside the article body.
function findPrimaryLink(contentHtml: string, base: string): string | null {
  const baseHost = new URL(base).hostname.replace(/^www\./, "");
  for (const m of contentHtml.matchAll(/href="([^"#]+)"/g)) {
    try {
      const u = new URL(m[1], base);
      const src = lookupSource(u.toString());
      if (src && src.tier === "primary" && u.hostname.replace(/^www\./, "") !== baseHost && u.pathname.length > 8) return u.toString();
    } catch {}
  }
  return null;
}

export async function fetchArticle(url: string, opts: { withPrimary?: boolean } = {}): Promise<Article> {
  const page = await readPage(url);
  const src = lookupSource(page.finalUrl);
  const host = new URL(page.finalUrl).hostname.replace(/^www\./, "");
  const art: Article = {
    url: page.finalUrl,
    title: page.title,
    text: page.text,
    sourceName: src?.name ?? host,
    tier: src?.tier ?? "unlisted",
    approved: !!src,
  };
  if (opts.withPrimary !== false && src?.tier !== "primary") {
    const link = findPrimaryLink(page.contentHtml, page.finalUrl);
    if (link) {
      try {
        const p = await readPage(link);
        const ps = lookupSource(p.finalUrl)!;
        art.primary = { kind: "primary", name: ps.name, url: p.finalUrl, approved: true, title: p.title, text: p.text };
      } catch {}
    }
  }
  return art;
}

// Paste-text fallback (used when a site blocks fetching)
export function articleFromText(text: string, title = "Pasted text"): Article {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 800) throw new FetchError("too_short", "Pasted text is too short");
  return { url: "", title, text: clean.slice(0, 24000), sourceName: "Pasted text", tier: "pasted", approved: false };
}
