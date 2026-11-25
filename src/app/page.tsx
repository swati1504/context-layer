"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ContextCard, { factsOf, readTime, type Card } from "@/components/ContextCard";
import Explainable from "@/components/Explainable";
import { addHistory, openProfile, rankReason, readHistory, useProfile } from "@/lib/profile";
import { FREE_LIMIT, atLimit, isStudy, log, markUsed, usedCards } from "@/lib/store";

type Item = { title: string; url: string; source: string; teaser: string; published: string; also: { source: string; url: string }[]; card: Card | null };
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
    setStudy(isStudy());
    setUsed(usedCards().length);
    setHist(readHistory());
    fetch("/api/feed").then((r) => r.json()).then((j) => setItems(j.items ?? [])).catch(() => setItems([]));
    const u = new URLSearchParams(window.location.search).get("u");
    if (u) window.location.replace(`/story?u=${encodeURIComponent(u)}`); // old share links
  }, []);

  const personal = !study && view === "you" && (!!profile?.interests.length || hist.length > 0);
  const ranked = useMemo(() => {
    if (!items) return null;
    const base = items.map((it, i) => ({ it, i, ...rankReason(profile, it.title + " " + it.teaser + " " + (it.card?.tags.join(" ") ?? ""), hist) }));
    if (personal) base.sort((a, b) => b.score - a.score || a.i - b.i);
    return (study ? base.slice(0, 6) : base).map((b) => ({ ...b.it, reason: personal && b.score > 0 ? b.reason : undefined }));
  }, [items, profile, hist, personal, study]);

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

  async function submitPaste(text?: string) {
    const raw = paste.trim();
    if (!raw && !text) return;
    const url = text ? "" : normalize(raw);
    const match = items?.find((i) => i.url === url);
    if (match) { document.getElementById("row-" + CSS.escape(match.url))?.scrollIntoView({ behavior: "smooth", block: "center" }); if (!open[match.url]) toggleRow(match); return; }
    if (!isStudy() && !(url && usedCards().includes(url)) && atLimit(url)) { setLimit(true); return; }
    setPurl(url);
    setPslot({ status: "loading" });
    log(text ? "paste_text_submit" : "get_context_click", { url, via: "paste" });
    const t0 = Date.now();
    const r = text ? await fetchCard({ text, title: raw ? new URL(url || "https://x").hostname : "Pasted text" }) : await fetchCard({ url });
    if (!r.card) { log("card_error", { url, code: r.code }); setPslot({ status: "error", error: r.error, code: r.code }); return; }
    if (!r.cached) { markUsed(url || "text:" + Date.now()); setUsed(usedCards().length); }
    log("card_generated", { url, ms: Date.now() - t0, verified: r.card.verification.verified, total: r.card.verification.total, cached: !!r.cached });
    setPslot({ status: "done", card: r.card });
    remember(r.card);
    setTimeout(() => { result.current?.scrollIntoView({ behavior: "smooth", block: "start" }); result.current?.focus(); }, 50);
  }

  function answer(url: string, a: "understand" | "partly" | "no") {
    log("familiarity_answer", { url, answer: a });
    setStages((s) => ({ ...s, [url]: "choose" }));
    setFam((f) => ({ ...f, [url]: a }));
  }

  const loadingPaste = pslot?.status === "loading";
  return (
    <main className="shell">
      <h1 className="hero">Understand the story, not just the headline.</h1>
      <p className="lede">Tech news in plain words. Highlight anything that confuses you to get more context, and every claim links to where it came from.</p>

      <form onSubmit={(e) => { e.preventDefault(); submitPaste(); }}>
        <div className="paste">
          <input aria-label="Link to a news story" type="text" inputMode="url" autoComplete="off" placeholder="Paste any news link" value={paste} onChange={(e) => setPaste(e.target.value)} />
          <button className="btn" disabled={!paste.trim() || loadingPaste}>{loadingPaste ? "Reading…" : "Get context"}</button>
        </div>
      </form>
      <div className="bar">
        <span>Works with any public article. Verified outlets are marked, others are labeled unverified.</span>
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
        <h2>{personal ? "Picked for you" : "Today’s tech news"}</h2>
        {!study && (profile?.interests.length ?? 0) > 0 && (
          <div className="seg" role="group" aria-label="Feed view">
            <button aria-pressed={view === "you"} onClick={() => { setView("you"); log("view_toggle", { view: "you" }); }}>For you</button>
            <button aria-pressed={view === "all"} onClick={() => { setView("all"); log("view_toggle", { view: "all" }); }}>All news</button>
          </div>
        )}
      </div>
      {!study && !profile && <p className="fine" style={{ margin: "10px 0 0" }}><button className="linkbtn" onClick={openProfile}>Pick your interests</button> and we will rank this list for you, and say why.</p>}

      <div>
        {ranked === null && <p className="empty">Loading stories…</p>}
        {ranked?.length === 0 && <p className="empty">Could not load the feed right now. Paste a link above to try a story.</p>}
        {ranked?.map((it) => {
          const slot = slots[it.url];
          const card = cardOf(it);
          const stage: Stage | undefined = study ? stages[it.url] ?? "ask" : undefined;
          const rich = !!card && !study;
          const isOpen = !!open[it.url];
          const body = (
            <>
              <div className="meta">
                <span>{it.source}</span>{it.published && <><span className="dot">·</span><span>{ago(it.published)}</span></>}
                {card && !study && <><span className="dot">·</span><span>{readTime(card.read_seconds)}</span></>}
                {it.reason && <span className="reason">{it.reason}</span>}
              </div>
              <h3>{rich ? card.headline : it.title}</h3>
              {rich ? (
                <>
                  <p className="summary">{card.summary.text}</p>
                  <ul className="pts">{card.key_points.filter((k) => k.text !== card.summary.text).slice(0, 3).map((k, i) => <li key={i}>{k.text}</li>)}</ul>
                  <button className="curious" onClick={() => toggleRow(it)} aria-expanded={isOpen}>{card.question}</button>
                </>
              ) : it.teaser && <p className="teaser">{it.teaser}</p>}

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
                  <button className="ghost" aria-expanded={isOpen} disabled={slot?.status === "loading"} onClick={() => toggleRow(it)}>
                    {slot?.status === "loading" ? "Reading…" : isOpen ? "Hide context" : "Get context"}
                  </button>
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
              {card ? <Explainable facts={factsOf(card)} headline={card.headline} url={it.url}>{body}</Explainable> : body}
            </article>
          );
        })}
      </div>
      {limit && <LimitModal onClose={() => setLimit(false)} />}
    </main>
  );
}
