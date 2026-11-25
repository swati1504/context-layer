"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ContextCard, { type Card } from "@/components/ContextCard";
import { openProfile, rankReason, useProfile } from "@/lib/profile";
import { FREE_LIMIT, atLimit, isStudy, log, markUsed, usedCards } from "@/lib/store";

type Item = { title: string; url: string; source: string; teaser: string; published: string };
type Slot = { status: "loading" | "done" | "error"; card?: Card; error?: string };
type Stage = "ask" | "choose" | "skipped";

const MESSAGES: Record<string, string> = {
  not_approved: "That site is not on our approved list, so we cannot verify it. Try coverage from TechCrunch, The Verge, Ars Technica, Reuters, AP, Wired or CNBC.",
  blocked: "We could not open that page. It may block automated readers or sit behind a paywall. Try another source for the same story.",
  too_short: "We could not read enough of that article to build a card. Try another source for the same story.",
  limit: "The daily card limit has been reached. Try again tomorrow.",
};

function ago(s: string) {
  const t = +new Date(s);
  if (!t) return "";
  const h = Math.max(0, Math.round((Date.now() - t) / 36e5));
  return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function LimitModal({ onClose }: { onClose: () => void }) {
  const [thanks, setThanks] = useState(false);
  useEffect(() => { log("limit_modal_view"); }, []);
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="lm-h" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 id="lm-h">You have used your {FREE_LIMIT} free cards this month</h2>
        <p>Free cards reset on the 1st. Plus gives you unlimited cards, saved history, and daily digests of the companies you follow.</p>
        <div className="kv"><span>Monthly</span><span>$4.99</span><span>Yearly</span><span>$39 (save 35%)</span></div>
        {thanks ? <p style={{ color: "var(--ok)" }}>Thanks. Plus is not open yet, and we noted your interest.</p> : (
          <div className="modal-acts" style={{ justifyContent: "flex-start" }}>
            <button className="btn" onClick={() => { log("limit_modal_cta"); setThanks(true); }}>Join the Plus waitlist</button>
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
  const [stages, setStages] = useState<Record<string, Stage>>({});
  const [paste, setPaste] = useState("");
  const [limit, setLimit] = useState(false);
  const [toast, setToast] = useState("");
  const [used, setUsed] = useState(0);

  useEffect(() => {
    setStudy(isStudy());
    setUsed(usedCards().length);
    fetch("/api/feed").then((r) => r.json()).then((j) => setItems(j.items ?? [])).catch(() => setItems([]));
    const u = new URLSearchParams(window.location.search).get("u");
    if (u) openCard(u, undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ranked = useMemo(() => {
    if (!items) return null;
    const base = items.map((it, i) => ({ it, i, ...rankReason(profile, it.title + " " + it.teaser) }));
    if (!study && profile) base.sort((a, b) => b.score - a.score || a.i - b.i);
    return (study ? base.slice(0, 6) : base).map((b) => ({ ...b.it, reason: b.score > 0 ? b.reason : undefined }));
  }, [items, profile, study]);

  async function openCard(url: string, familiarity?: string, fromShare = false) {
    if (slots[url]?.status === "done" && !fromShare) {
      setSlots((s) => { const n = { ...s }; delete n[url]; return n; });
      return;
    }
    if (!isStudy() && atLimit(url)) { setLimit(true); return; }
    log("get_context_click", { url, familiarity: familiarity ?? null, via: fromShare ? "share" : "click" });
    setSlots((s) => ({ ...s, [url]: { status: "loading" } }));
    const t0 = Date.now();
    try {
      const r = await fetch("/api/card", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const j = await r.json();
      if (!r.ok) throw new Error(MESSAGES[j.error] ?? "Something went wrong building the card. Try again.");
      markUsed(url);
      setUsed(usedCards().length);
      log("card_generated", { url, ms: Date.now() - t0, verified: j.card.verification.verified, total: j.card.verification.total, cached: !!j.cached });
      setSlots((s) => ({ ...s, [url]: { status: "done", card: j.card } }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong building the card. Try again.";
      log("card_error", { url, msg });
      setSlots((s) => ({ ...s, [url]: { status: "error", error: msg } }));
    }
  }

  function answer(url: string, a: "understand" | "partly" | "no") {
    log("familiarity_answer", { url, answer: a });
    setStages((s) => ({ ...s, [url]: "choose" }));
    setFam((f) => ({ ...f, [url]: a }));
  }
  const [fam, setFam] = useState<Record<string, string>>({});

  async function share(url: string) {
    const link = `${window.location.origin}/?u=${encodeURIComponent(url)}`;
    try { await navigator.clipboard.writeText(link); setToast("Link copied"); } catch { setToast("Could not copy the link"); }
    log("share", { url });
    setTimeout(() => setToast(""), 2200);
  }

  const pasted = paste.trim();
  const pslot = slots[pasted];

  return (
    <main className="shell">
      <div className="cols">
        <div>
          <h1 className="hero">The tech news you keep scrolling past, explained.</h1>
          <p className="lede">Paste a link or pick a story below. You get what happened and how it works in plain words, and every claim is checked against the article.</p>

          <form className="paste" onSubmit={(e) => { e.preventDefault(); if (pasted) openCard(pasted); }}>
            <input aria-label="Article link" type="url" inputMode="url" placeholder="Paste a link from TechCrunch, The Verge, Ars Technica…" value={paste} onChange={(e) => setPaste(e.target.value)} />
            <button className="btn" disabled={!pasted || pslot?.status === "loading"}>{pslot?.status === "loading" ? "Reading…" : "Get context"}</button>
          </form>
          <p className="fine">Only approved sources are read, so every claim can be checked. <Link href="/verify">How we verify</Link></p>
          {pslot?.status === "loading" && <p className="skeleton">Reading the article and checking each claim. This takes about 10 seconds.</p>}
          {pslot?.status === "error" && <p className="err">{pslot.error}</p>}
          {pslot?.status === "done" && pslot.card && <ContextCard card={pslot.card} url={pasted} onShare={() => share(pasted)} />}

          <div className="feed-head">
            <h2>{profile && !study ? "Picked for you" : "Today’s launches"}</h2>
            <span>Fresh from approved sources</span>
          </div>
          <div className="list">
            {ranked === null && <p className="empty">Loading stories…</p>}
            {ranked?.length === 0 && <p className="empty">Could not load the feed right now. Paste a link above to try a story.</p>}
            {ranked?.map((it) => {
              const slot = slots[it.url];
              const stage: Stage | undefined = study ? stages[it.url] ?? "ask" : undefined;
              return (
                <article className="row" key={it.url}>
                  <div className="meta"><span>{it.source}{it.published ? ` – ${ago(it.published)}` : ""}</span>{it.reason && <span className="reason">{it.reason}</span>}</div>
                  <h3>{it.title}</h3>
                  {it.teaser && <p className="teaser">{it.teaser}</p>}

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
                      <button className="ghost" aria-expanded={slot?.status === "done"} disabled={slot?.status === "loading"} onClick={() => openCard(it.url, fam[it.url])}>
                        {slot?.status === "loading" ? "Reading…" : slot?.status === "done" ? "Hide context" : "Get context"}
                      </button>
                      {study && !slot && <button className="quiet" onClick={() => { log("skip_click", { url: it.url, familiarity: fam[it.url] ?? null }); setStages((s) => ({ ...s, [it.url]: "skipped" })); }}>Continue without context</button>}
                    </div>
                  )}
                  {study && stage === "skipped" && <p className="fine" style={{ margin: 0 }}>Skipped. Thanks.</p>}
                  {slot?.status === "loading" && <p className="skeleton">Reading the article and checking each claim.</p>}
                  {slot?.status === "error" && <p className="err">{slot.error}</p>}
                  {slot?.status === "done" && slot.card && <ContextCard card={slot.card} url={it.url} onShare={() => share(it.url)} />}
                </article>
              );
            })}
          </div>
        </div>

        {!study && (
          <aside className="rail" aria-label="About you and the plan">
            <div className="box">
              <h3>Your profile</h3>
              {profile ? (
                <>
                  <div className="kv"><span>Role</span><span>{profile.role}</span><span>Industry</span><span>{profile.industry}</span><span>Tech comfort</span><span>{profile.comfort === "beginner" ? "New to tech" : profile.comfort === "some" ? "Some familiarity" : "Comfortable"}</span></div>
                  <button className="quiet" onClick={openProfile}>Edit profile</button>
                </>
              ) : (
                <>
                  <p>Add your role and industry. Stories get ranked for you and each card explains why it matters.</p>
                  <button className="btn" onClick={openProfile}>Set up in 30 seconds</button>
                </>
              )}
            </div>
            <div className="box">
              <h3>Free plan</h3>
              <p style={{ marginBottom: 4 }}>{Math.min(used, FREE_LIMIT)} of {FREE_LIMIT} cards used this month</p>
              <div className="meter" aria-hidden="true"><i style={{ width: `${(Math.min(used, FREE_LIMIT) / FREE_LIMIT) * 100}%` }} /></div>
              <Link href="/pricing">See Plus</Link>
            </div>
            <div className="box">
              <h3>Why trust a card?</h3>
              <p>Every claim carries a quote from the article. If we cannot find the quote, the claim is removed before you see it.</p>
              <Link href="/verify">How we verify</Link>
            </div>
          </aside>
        )}
      </div>
      {limit && <LimitModal onClose={() => setLimit(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
