"use client";
import { useEffect, useState } from "react";
import ContextCard, { type Card } from "@/components/ContextCard";

type Item = { title: string; url: string; source: string; teaser: string; published: string };
type Slot = { status: "loading" | "done" | "error"; card?: Card; error?: string };

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

export default function Home() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [paste, setPaste] = useState("");

  useEffect(() => {
    fetch("/api/feed").then((r) => r.json()).then((j) => setItems(j.items ?? [])).catch(() => setItems([]));
  }, []);

  async function getCard(url: string) {
    if (slots[url]?.status === "done") { // toggle closed
      setSlots((s) => { const n = { ...s }; delete n[url]; return n; });
      return;
    }
    setSlots((s) => ({ ...s, [url]: { status: "loading" } }));
    try {
      const r = await fetch("/api/card", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const j = await r.json();
      if (!r.ok) throw new Error(MESSAGES[j.error] ?? "Something went wrong building the card. Try again.");
      setSlots((s) => ({ ...s, [url]: { status: "done", card: j.card } }));
    } catch (e) {
      setSlots((s) => ({ ...s, [url]: { status: "error", error: e instanceof Error ? e.message : "Something went wrong building the card. Try again." } }));
    }
  }

  const pasted = paste.trim();
  const pslot = slots[pasted];

  return (
    <main className="wrap">
      <div className="top">
        <span className="brand">Context Layer</span>
        <small>Cornell Tech Product Studio, Team 801</small>
      </div>

      <h1 className="hero">The tech news you keep scrolling past, explained.</h1>
      <p className="lede">Paste a link or pick a story below. You get what happened and how it works in plain words, and every claim is checked against the article.</p>

      <form className="paste" onSubmit={(e) => { e.preventDefault(); if (pasted) getCard(pasted); }}>
        <input aria-label="Article link" type="url" inputMode="url" placeholder="Paste a link from TechCrunch, The Verge, Ars Technica…" value={paste} onChange={(e) => setPaste(e.target.value)} />
        <button className="btn" disabled={!pasted || pslot?.status === "loading"}>{pslot?.status === "loading" ? "Reading…" : "Get context"}</button>
      </form>
      <p className="fine">Only approved sources are read, so every claim can be checked.</p>
      {pslot?.status === "loading" && <p className="skeleton">Reading the article and checking each claim. This takes about 10 seconds.</p>}
      {pslot?.status === "error" && <p className="err">{pslot.error}</p>}
      {pslot?.status === "done" && pslot.card && <ContextCard card={pslot.card} />}

      <div className="feed-head">
        <h2>Today&rsquo;s launches</h2>
        <span>Fresh from approved sources</span>
      </div>
      {items === null && <p className="empty">Loading stories&hellip;</p>}
      {items?.length === 0 && <p className="empty">Could not load the feed right now. Paste a link above to try a story.</p>}
      {items?.map((it) => {
        const slot = slots[it.url];
        return (
          <article className="row" key={it.url}>
            <div className="meta">{it.source}{it.published ? ` – ${ago(it.published)}` : ""}</div>
            <h3>{it.title}</h3>
            {it.teaser && <p className="teaser">{it.teaser}</p>}
            <button className="ghost" aria-expanded={slot?.status === "done"} disabled={slot?.status === "loading"} onClick={() => getCard(it.url)}>
              {slot?.status === "loading" ? "Reading…" : slot?.status === "done" ? "Hide context" : "Get context"}
            </button>
            {slot?.status === "loading" && <p className="skeleton">Reading the article and checking each claim.</p>}
            {slot?.status === "error" && <p className="err">{slot.error}</p>}
            {slot?.status === "done" && slot.card && <ContextCard card={slot.card} />}
          </article>
        );
      })}
    </main>
  );
}
