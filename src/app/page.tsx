"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Trending from "@/components/Trending";
import ContextCard, { TermText, factsOf, readTime, type Card } from "@/components/ContextCard";
import Explainable from "@/components/Explainable";
import StoryImage from "@/components/StoryImage";
import { ShareIcon, WhyThis } from "@/components/FeedBits";
import { addHistory, openProfile, rankReason, readHistory, useProfile } from "@/lib/profile";
import { FREE_LIMIT, atLimit, isStudy, log, markUsed, useFavs, usedCards } from "@/lib/store";

type Item = { title: string; url: string; source: string; teaser: string; published: string; topics: string[]; also: { source: string; url: string }[]; card: Card | null };
type Slot = { status: "loading" | "done" | "error"; card?: Card; error?: string; code?: string };
type Stage = "ask" | "choose" | "skipped";

const MESSAGES: Record<string, string> = {
  blocked: "We could not open that page. It may sit behind a paywall or block automated readers. Paste the article text below and we will explain that instead.",
  too_short: "We could not read enough of that page. Paste the article text below and we will explain that instead.",
  bad_url: "That does not look like a link to a news story. Paste the full address, for example https://techcrunch.com/…",
  limit: "The daily card limit has been reached. Try again tomorrow.",
};

function ago(s: string) {
  const t = +new Date(s);
  if (!t) return "";
  const h = Math.max(0, Math.round((Date.now() - t) / 36e5));
  return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}
const WHY_RULES = "Stories are ordered by simple rules: the interests you picked, stories you read or saved, how many outlets cover it, and how new it is. No hidden profile.";
function whyOf(it: Item, personal: string | undefined, saved: string[]): { reason: string; explain: string } | null {
  if (personal) return { reason: personal, explain: `${personal}. ${WHY_RULES}` };
  const tags = (it.card?.tags ?? []).map((t) => t.toLowerCase());
  const s = saved.find((t) => tags.includes(t));
  if (s) return { reason: `Like stories you saved`, explain: `You saved a story tagged “${s}”, and this one shares that tag. ${WHY_RULES}` };
  if (it.also.length > 0) return { reason: `Covered by ${it.also.length + 1} outlets`, explain: `Several outlets reported this story, which moves it up. ${WHY_RULES}` };
  const h = it.published ? (Date.now() - +new Date(it.published)) / 36e5 : 99;
  if (h < 24) return { reason: "New today", explain: `It was published in the last day. ${WHY_RULES}` };
  return null;
}
const normalize = (s: string) => (/^https?:\/\//i.test(s) ? s : `https://${s}`);

async function fetchCard(body: object): Promise<{ card?: Card; cached?: boolean; error?: string; code?: string }> {
  try {
    const r = await fetch("/api/card", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) return { code: j.error, error: MESSAGES[j.error] ?? "Something went wrong building the card. Try again." };
    return { card: j.card, cached: !!j.cached };
  } catch { return { error: "Something went wrong building the card. Try again." }; }
}

function LimitModal({ onClose }: { onClose: () => void }) {
  const [thanks, setThanks] = useState(false);
  useEffect(() => {
    log("limit_modal_view");
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="lm-h">
        <h2 id="lm-h">You have used your {FREE_LIMIT} free links this month</h2>
        <p>Stories in the feed and shared stories stay free. Pasting your own links resets on the 1st. Plus is coming soon: unlimited links, saved history, and a daily digest. It is not open yet.</p>
        <div className="kv"><span>Planned monthly</span><span>$4.99</span><span>Planned yearly</span><span>$39</span></div>
        {thanks ? <p style={{ color: "var(--ok)" }}>Noted. We will tell you when Plus opens.</p> : (
          <div className="modal-acts" style={{ justifyContent: "flex-start" }}>
            <button className="btn" onClick={() => { log("limit_modal_cta"); setThanks(true); }}>Tell me when Plus opens</button>
            <button className="btn sec-btn" onClick={onClose}>Maybe later</button>
          </div>
        )}
        {thanks && <div className="modal-acts"><button className="btn sec-btn" onClick={onClose}>Close</button></div>}
      </div>
    </div>
  );
}

export default function Home() {
  const profile = useProfile();
  const favs = useFavs();
  const [study, setStudy] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [stages, setStages] = useState<Record<string, Stage>>({});
  const [fam, setFam] = useState<Record<string, string>>({});
  const [paste, setPaste] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pslot, setPslot] = useState<Slot | null>(null);
  const [purl, setPurl] = useState("");
  const [limit, setLimit] = useState(false);
  const [used, setUsed] = useState(0);
  const [hist, setHist] = useState<string[]>([]);
  const [view, setView] = useState<"you" | "all">("you");
  const result = useRef<HTMLElement>(null);

  useEffect(() => {
    const st = isStudy();
    setStudy(st);
    try {
      const q = new URLSearchParams(window.location.search);
      if (!st && !q.get("u") && !q.get("home") && !localStorage.getItem("cl_seen")) { window.location.replace("/welcome"); return; }
    } catch {}
    setUsed(usedCards().length);
    setHist(readHistory());
    fetch("/api/feed").then((r) => r.json()).then((j) => setItems(j.items ?? [])).catch(() => setItems([]));
    const u = new URLSearchParams(window.location.search).get("u");
    if (u) window.location.replace(`/story?u=${encodeURIComponent(u)}`); // old share links
  }, []);

  const personal = !study && view === "you" && !!profile?.interests.length;
  const ranked = useMemo(() => {
    if (!items) return null;
    const base = items.map((it, i) => ({ it, i, ...rankReason(profile, it.topics ?? [], hist, it.title + " " + it.teaser + " " + (it.card?.tags.join(" ") ?? "")) }));
    const list = study ? base.slice(0, 6) : base;
    if (!personal) return { rows: list.map((b) => ({ ...b.it, reason: undefined as string | undefined })), split: -1 };
    const hit = list.filter((b) => b.match).sort((a, b) => b.score - a.score || a.i - b.i);
    const rest = list.filter((b) => !b.match).sort((a, b) => b.score - a.score || a.i - b.i);
    return { rows: [...hit, ...rest].map((b) => ({ ...b.it, reason: b.match || b.score > 0 ? b.reason : undefined })), split: hit.length };
  }, [items, profile, hist, personal, study]);

  const savedTags = useMemo(() => favs.flatMap((f) => (f.card?.tags ?? []).map((t: string) => t.toLowerCase())), [favs]);
  const cardOf = (it: Item) => slots[it.url]?.card ?? it.card ?? undefined;

  function remember(card: Card) { addHistory(card.tags); setHist(readHistory()); }

  async function toggleRow(it: Item) {
    const url = it.url;
    if (open[url]) { setOpen((o) => ({ ...o, [url]: false })); return; }
    log("get_context_click", { url, familiarity: fam[url] ?? null, cached: !!cardOf(it) });
    const have = cardOf(it);
    if (have) { setOpen((o) => ({ ...o, [url]: true })); remember(have); return; }
    setSlots((s) => ({ ...s, [url]: { status: "loading" } }));
    const t0 = Date.now();
    const r = await fetchCard({ url });
    if (!r.card) { log("card_error", { url, code: r.code }); setSlots((s) => ({ ...s, [url]: { status: "error", error: r.error, code: r.code } })); return; }
    log("card_generated", { url, ms: Date.now() - t0, verified: r.card.verification.verified, total: r.card.verification.total, cached: !!r.cached });
    setSlots((s) => ({ ...s, [url]: { status: "done", card: r.card } }));
    setOpen((o) => ({ ...o, [url]: true }));
    remember(r.card);
  }

  async function submitPaste(text?: string, source?: "screenshot") {
    const raw = paste.trim();
    if (!raw && !text) return;
    const url = text ? "" : normalize(raw);
    const match = items?.find((i) => i.url === url);
    if (match) { document.getElementById("row-" + CSS.escape(match.url))?.scrollIntoView({ behavior: "smooth", block: "center" }); if (!open[match.url]) toggleRow(match); return; }
    if (!isStudy() && !(url && usedCards().includes(url)) && atLimit(url)) { setLimit(true); return; }
    setPurl(url);
    setPslot({ status: "loading" });
    log(text ? (source ? "screenshot_submit" : "paste_text_submit") : "get_context_click", { url, via: "paste" });
    const t0 = Date.now();
    const r = text ? await fetchCard({ text, source, title: source === "screenshot" ? "Your screenshot" : raw ? new URL(url || "https://x").hostname : "Pasted text" }) : await fetchCard({ url });
    if (!r.card) { log("card_error", { url, code: r.code }); setPslot({ status: "error", error: r.error, code: r.code }); return; }
    if (!r.cached) { markUsed(url || "text:" + Date.now()); setUsed(usedCards().length); }
    log("card_generated", { url, ms: Date.now() - t0, verified: r.card.verification.verified, total: r.card.verification.total, cached: !!r.cached });
    setPslot({ status: "done", card: r.card });
    remember(r.card);
    setTimeout(() => { result.current?.scrollIntoView({ behavior: "smooth", block: "start" }); result.current?.focus(); }, 50);
  }

  const fileRef = useRef<HTMLInputElement>(null);
  const [shotBusy, setShotBusy] = useState(false);
  async function onShot(f: File | undefined) {
    if (!f) return;
    if (!isStudy() && atLimit("")) { setLimit(true); return; }
    setShotBusy(true);
    setPslot({ status: "loading" });
    try {
      const bmp = await createImageBitmap(f);
      const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      const image = c.toDataURL("image/jpeg", 0.85);
      const r = await fetch("/api/ocr", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.text) { setPslot({ status: "error", error: j.error === "no_text" ? "We could not find article text in that image. Try a clearer screenshot of the article itself." : j.error === "limit" ? MESSAGES.limit : "Could not read that image. Try again or paste the link." }); return; }
      setPurl("");
      await submitPaste(j.text, "screenshot");
    } catch { setPslot({ status: "error", error: "Could not read that image. Try again or paste the link." }); } finally { setShotBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  function answer(url: string, a: "understand" | "partly" | "no") {
    log("familiarity_answer", { url, answer: a });
    setStages((s) => ({ ...s, [url]: "choose" }));
    setFam((f) => ({ ...f, [url]: a }));
  }

  const loadingPaste = pslot?.status === "loading";
  return (
    <div className="layout">
    <main className="shell">
      <h1 className="hero">Understand the story, not just the headline.</h1>
      <p className="lede">Tech news in plain words. Highlight anything that confuses you to get more context, and every claim links to where it came from.</p>

      <form onSubmit={(e) => { e.preventDefault(); submitPaste(); }}>
        <div className="paste">
          <input aria-label="Link to a news story" type="text" inputMode="url" autoComplete="off" placeholder="Paste any news link" value={paste} onChange={(e) => setPaste(e.target.value)} />
          <button className="btn" disabled={!paste.trim() || loadingPaste}>{loadingPaste ? "Reading…" : "Get context"}</button>
        </div>
      </form>
      {!study && (
        <p className="fine" style={{ margin: "8px 0 0" }}>
          Or <button type="button" className="linkbtn" disabled={shotBusy || loadingPaste} onClick={() => fileRef.current?.click()}>upload a screenshot</button> of an article. Screenshots are labeled as not independently checked.
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onShot(e.target.files?.[0])} />
        </p>
      )}
      <div className="bar">
        <span>Works with any public article. Outlets are labeled On our source list or Outside our source list.</span>
        {!study && <><span className="sep">|</span><span>{Math.min(used, FREE_LIMIT)} of {FREE_LIMIT} free links used this month. Feed stories are free. <Link href="/pricing">Plus is coming soon</Link></span></>}
      </div>

      {loadingPaste && <p className="skeleton" role="status">Reading the article and checking every quote. This takes about 15 seconds.</p>}
      {pslot?.status === "error" && (
        <div role="alert">
          <p className="err">{pslot.error}</p>
          {(pslot.code === "blocked" || pslot.code === "too_short") && (
            <div className="fallback" style={{ marginTop: 10 }}>
              <textarea aria-label="Article text" placeholder="Paste the article text here" value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
              <div className="actions" style={{ marginTop: 8 }}><button className="btn" disabled={pasteText.trim().length < 400} onClick={() => submitPaste(pasteText)}>Explain this text</button><span className="fine">At least a few paragraphs.</span></div>
            </div>
          )}
        </div>
      )}
      {pslot?.status === "done" && pslot.card && (
        <section ref={result} tabIndex={-1} aria-label="Your story" style={{ marginTop: 28, outline: "none" }}>
          <Explainable facts={factsOf(pslot.card)} headline={pslot.card.headline} url={purl}>
            <ContextCard card={pslot.card} url={purl} />
          </Explainable>
        </section>
      )}

      <div className="feed-head">
        <h2>Today’s tech news</h2>
        {!study && (
          <div className="seg" role="group" aria-label="Feed view">
            <button aria-pressed={personal} onClick={() => { log("view_toggle", { view: "you" }); if (!profile?.interests.length) openProfile(); else setView("you"); }}>For you</button>
            <button aria-pressed={!personal} onClick={() => { setView("all"); log("view_toggle", { view: "all" }); }}>All news</button>
          </div>
        )}
      </div>
      {!study && <p className="fine" style={{ margin: "10px 0 0" }}>Tap underlined words for a quick explanation, or highlight any text. <button className="linkbtn" onClick={openProfile}>Pick your interests</button> to rank this list for you.</p>}

      <div>
        {ranked === null && <p className="empty">Loading stories…</p>}
        {ranked?.rows.length === 0 && <p className="empty">Could not load the feed right now. Paste a link above to try a story.</p>}
        {personal && ranked && ranked.split === 0 && <p className="fine" style={{ margin: "16px 0 0" }}>No stories match your picks right now. Showing everything instead, and we will keep looking.</p>}
        {ranked?.rows.map((it, idx) => {
          const slot = slots[it.url];
          const card = cardOf(it);
          const stage: Stage | undefined = study ? stages[it.url] ?? "ask" : undefined;
          const rich = !!card && !study;
          const isOpen = !!open[it.url];
          const body = (
            <>
              <div className="meta">
                {it.published && <span>{ago(it.published)}</span>}
                {card && !study && <>{it.published && <span className="dot">·</span>}<span>{readTime(card.read_seconds)}</span></>}
                {study && it.reason && <span className="reason">{it.reason}</span>}
              </div>
              {rich ? (
                <div className="rowgrid">
                  <div className="rowmain">
                    <h3>{card.headline}</h3>
                    <p className="summary clamp"><TermText text={card.summary.text} jargon={card.jargon} url={it.url} /></p>
                    {card.tags.length > 0 && <ul className="tags" aria-label="Topics">{card.tags.slice(0, 3).map((t) => <li key={t}>{t}</li>)}</ul>}
                  </div>
                  <StoryImage seed={it.url} text={it.title + " " + card.summary.text} topics={it.topics} />
                </div>
              ) : (
                study ? (
                  <>
                    <h3>{it.title}</h3>
                    {it.teaser && <p className="teaser">{it.teaser}</p>}
                  </>
                ) : (
                  <div className="rowgrid">
                    <div className="rowmain">
                      <h3>{it.title}</h3>
                      {it.teaser && <p className="teaser" style={{ marginBottom: 12 }}>{it.teaser}</p>}
                      {it.topics?.length > 0 && <ul className="tags" aria-label="Topics">{it.topics.slice(0, 3).map((t) => <li key={t}>{t}</li>)}</ul>}
                    </div>
                    <StoryImage seed={it.url} text={it.title + " " + it.teaser} topics={it.topics} />
                  </div>
                )
              )}

              {study && stage === "ask" && (
                <div className="ask" role="group" aria-label="How well do you understand this story?">
                  <p>Before you decide: how well do you understand this story?</p>
                  <div className="actions">
                    <button className="quiet" onClick={() => answer(it.url, "understand")}>I understand it</button>
                    <button className="quiet" onClick={() => answer(it.url, "partly")}>Partly</button>
                    <button className="quiet" onClick={() => answer(it.url, "no")}>Not really</button>
                  </div>
                </div>
              )}
              {(!study || stage === "choose") && (
                <div className="actions">
                  {rich && <Link className="btn" href={`/story?u=${encodeURIComponent(it.url)}`}>Read the story</Link>}
                  <button className="ghost" aria-expanded={isOpen} disabled={slot?.status === "loading"} onClick={() => toggleRow(it)}>
                    {slot?.status === "loading" ? "Reading…" : isOpen ? "Hide context" : rich ? "Quick context" : "Get context"}
                  </button>
                  {rich && <span className="actspacer" />}
                  {rich && (() => { const w = whyOf(it, it.reason, savedTags); return w ? <WhyThis reason={w.reason} explain={w.explain} /> : null; })()}
                  {rich && <ShareIcon url={it.url} title={card.headline} />}
                  {study && !slot && !isOpen && <button className="quiet" onClick={() => { log("skip_click", { url: it.url, familiarity: fam[it.url] ?? null }); setStages((s) => ({ ...s, [it.url]: "skipped" })); }}>Continue without context</button>}
                </div>
              )}
              {study && stage === "skipped" && <p className="fine" style={{ margin: 0 }}>Skipped. Thanks.</p>}
              {slot?.status === "loading" && <p className="skeleton" role="status">Reading the article and checking every quote.</p>}
              {slot?.status === "error" && <p className="err">{slot.error} You can also paste the article text in the box at the top.</p>}
              {isOpen && card && <ContextCard card={card} url={it.url} inline={rich} />}
              {!study && it.also.length > 0 && (
                <p className="also">Also covered by {it.also.map((a, i) => <span key={a.url}>{i > 0 && ", "}<a href={a.url} target="_blank" rel="noopener noreferrer">{a.source}</a></span>)}</p>
              )}
            </>
          );
          return (
            <article className="row" id={"row-" + it.url} key={it.url}>
              {personal && ranked && ranked.split > 0 && idx === ranked.split && <h2 className="splitnote">Other news today</h2>}
              {card ? <Explainable facts={factsOf(card)} headline={card.headline} url={it.url}>{body}</Explainable> : body}
            </article>
          );
        })}
      </div>
      {limit && <LimitModal onClose={() => setLimit(false)} />}
    </main>
    {!study && <Trending />}
    </div>
  );
}
