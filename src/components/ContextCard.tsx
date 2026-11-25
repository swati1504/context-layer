"use client";
import Link from "next/link";
import { useState } from "react";
import { copyShare, log, markReported, pid, toggleFav, useFavs } from "@/lib/store";

export type Claim = { text: string; quote: string; from: "primary" | "reporting" };
export type Card = {
  v: 2;
  rev?: number;
  headline: string;
  publisher_headline: string;
  summary: Claim & { quotes?: string[] };
  key_points: Claim[];
  how_it_works: Claim[];
  perspectives: { who: string; stance: string; quote: string; from: "primary" | "reporting" }[];
  jargon: { term: string; plain: string }[];
  question: string;
  tags: string[];
  read_seconds: number;
  verification: { total: number; verified: number; dropped: number };
  approved: boolean;
  sources: { kind: "primary" | "reporting"; name: string; url: string; approved: boolean }[];
};

export const readTime = (s: number) => (s < 60 ? `${s} sec read` : `${Math.round(s / 60)} min read`);
export const factsOf = (c: Card) => [c.summary, ...c.key_points, ...c.how_it_works].map((x) => `${x.text} (${(x as { quotes?: string[] }).quotes?.join(" ... ") ?? x.quote})`).concat(c.perspectives.map((p) => `${p.who}: ${p.stance} (${p.quote})`));

// Opens the original page scrolled to the passage and highlighted (browser text-fragment link).
function fragmentUrl(url: string, quote: string) {
  if (!url) return "";
  const words = quote.replace(/\s+/g, " ").trim().split(" ");
  const enc = (s: string) => encodeURIComponent(s).replace(/-/g, "%2D");
  const frag = words.length <= 8 ? enc(words.join(" ")) : `${enc(words.slice(0, 4).join(" "))},${enc(words.slice(-4).join(" "))}`;
  return `${url}#:~:text=${frag}`;
}

function ClaimLine({ c, card, section, url }: { c: { text: string; quote: string; from: "primary" | "reporting" }; card: Card; section: string; url: string }) {
  const src = card.sources.find((s) => s.kind === c.from) ?? card.sources[card.sources.length - 1];
  const href = fragmentUrl(src?.url ?? "", c.quote);
  return (
    <div className="claim">
      <p>{c.text}{c.from === "primary" && <span className="tag-from">{src?.name}</span>}</p>
      {href && (
        <a className="src" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Show where this comes from in ${src?.name}: ${c.text.slice(0, 60)}`} onClick={() => log("claim_opened", { url, section })}>
          Show where this comes from
        </a>
      )}
    </div>
  );
}

function Simpler({ subject, text, quote, url }: { subject: string; text: string; quote: string; url: string }) {
  const [state, setState] = useState<{ s: "idle" | "load" | "done" | "err"; out?: string }>({ s: "idle" });
  async function go() {
    setState({ s: "load" });
    log("simplify_click", { url, subject });
    try {
      const r = await fetch("/api/simplify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject, text, quote }) });
      const j = await r.json();
      setState(r.ok ? { s: "done", out: j.explanation } : { s: "err" });
    } catch { setState({ s: "err" }); }
  }
  return (
    <div style={{ marginTop: 6 }}>
      {state.s !== "done" && <button className="linkbtn" onClick={go} disabled={state.s === "load"}>{state.s === "load" ? "Simplifying…" : "Still confusing?"}</button>}
      {state.s === "err" && <span className="err"> Could not simplify that. Try again.</span>}
      {state.s === "done" && <p className="define"><b>In simpler words:</b> {state.out}</p>}
    </div>
  );
}

function Report({ card, url, onDone }: { card: Card; url: string; onDone: () => void }) {
  const claims = [card.summary, ...card.key_points, ...card.how_it_works].map((c) => c.text).concat(card.perspectives.map((p) => p.stance));
  const [which, setWhich] = useState("");
  const [reason, setReason] = useState("It is not in the source");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  function send(e: React.FormEvent) {
    e.preventDefault();
    const claim = (which || "(whole story)") + (note.trim() ? ` || NOTE: ${note.trim()}` : "");
    log("report", { url, reason });
    markReported(url + "|" + which.slice(0, 40));
    fetch("/api/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, claim, reason, pid: pid() }) }).catch(() => {});
    setSent(which || "the whole story");
  }
  if (sent) return <p className="report" role="status">Thanks. We logged your report on: {sent.length > 90 ? sent.slice(0, 87) + "…" : sent}. The team reviews every report, and a claim that is wrong gets removed or fixed. <button className="linkbtn" onClick={onDone}>Close</button></p>;
  return (
    <form className="report" onSubmit={send} aria-label="Report a problem">
      <label>What is wrong?
        <select value={which} onChange={(e) => setWhich(e.target.value)}>
          <option value="">The story as a whole</option>
          {claims.map((c, i) => <option key={i} value={c}>{c.length > 80 ? c.slice(0, 77) + "…" : c}</option>)}
        </select>
      </label>
      <label>The problem
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {["It is not in the source", "It is misleading", "It is out of date", "Something else"].map((r) => <option key={r}>{r}</option>)}
        </select>
      </label>
      <label>What did we miss? (optional)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={400} />
      </label>
      <div className="actions"><button className="btn">Send report</button><button type="button" className="quiet" onClick={onDone}>Cancel</button></div>
    </form>
  );
}

// `inline` = used inside a feed row that already shows the headline, summary and key points.
export default function ContextCard({ card, url, inline = false }: { card: Card; url: string; inline?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [copied, setCopied] = useState("");
  const favs = useFavs();
  const isFav = !!url && favs.some((f) => f.url === url);
  const sides = [...card.perspectives].sort((a, b) => (a.from === "primary" ? 0 : 1) - (b.from === "primary" ? 0 : 1));
  const passages = 1 + card.key_points.length + card.how_it_works.length + card.perspectives.length;
  const rep = card.sources.find((s) => s.kind === "reporting");
  const quoteFor = (term: string) => [...card.how_it_works, ...card.key_points].find((c) => (c.text + c.quote).toLowerCase().includes(term.toLowerCase()))?.quote ?? card.how_it_works[0]?.quote ?? card.summary.quote;

  return (
    <div className={inline ? "card" : "card full"}>
      {!card.approved && (
        <p className="notice" role="note"><b>Unverified source.</b> This site is not on our verified list. We still checked every quote against the page, but we cannot vouch for the publication itself.</p>
      )}
      {!inline && (
        <div className="sec">
          <h1 className="story">{card.headline}</h1>
          <p className="orig">From {rep?.name}: {card.publisher_headline}</p>
          <h5>The short version</h5>
          <ClaimLine c={card.summary} card={card} section="short" url={url} />
          {card.key_points.map((c, i) => <ClaimLine key={i} c={c} card={card} section="short" url={url} />)}
        </div>
      )}

      {card.how_it_works.length > 0 && (
        <div className="sec">
          <h5>How it works</h5>
          {card.how_it_works.map((c, i) => <ClaimLine key={i} c={c} card={card} section="how_it_works" url={url} />)}
          <Simpler url={url} subject="How it works" text={card.how_it_works.map((c) => c.text).join(" ")} quote={card.how_it_works.map((c) => c.quote).join(" ")} />
          {card.jargon.length > 0 && (
            <>
              <div className="chips">
                {card.jargon.map((j) => (
                  <button key={j.term} className="chip" aria-expanded={open === j.term} onClick={() => { setOpen(open === j.term ? null : j.term); log("section_open", { url, section: "jargon", term: j.term }); }}>{j.term}</button>
                ))}
              </div>
              {card.jargon.filter((j) => j.term === open).map((j) => (
                <div key={j.term}>
                  <p className="define"><b>{j.term}:</b> {j.plain}</p>
                  <Simpler url={url} subject={j.term} text={j.plain} quote={quoteFor(j.term)} />
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <div className="sec">
        <h5>What people are saying</h5>
        {sides.length === 0 && <p style={{ margin: 0, color: "var(--muted)" }}>This story reports one account. Nobody else is quoted in it.</p>}
        {sides.map((p, i) => (
          <div className="side" key={i}>
            <b>{p.who}{p.from === "primary" && <span className="tag-from">From the company</span>}</b>
            <ClaimLine c={{ text: p.stance, quote: p.quote, from: p.from }} card={card} section="perspective" url={url} />
          </div>
        ))}
      </div>

      <div className="foot">
        <div className="row2">
          <span className="grow">
            Sources:{" "}
            {card.sources.map((s, i) => (
              <span key={s.url}>{i > 0 && " · "}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a>{s.kind === "primary" ? " (company announcement)" : ""}{!s.approved ? " (unverified)" : ""}</span>
            ))}
          </span>
          {url && <button className="quiet" aria-pressed={isFav} onClick={() => { const on = toggleFav({ url, title: card.headline, source: rep?.name ?? "", card }); log("favorite", { url, on }); }}>{isFav ? "Saved" : "Save"}</button>}
          {url && <button className="quiet" onClick={async () => { setCopied((await copyShare(url)) ? "Link copied" : "Could not copy"); setTimeout(() => setCopied(""), 2200); }}>{copied || "Share"}</button>}
        </div>
        <div className="row2">
          <span className="grow">{passages} source passages attached. <Link href="/verify">How we check</Link></span>
          {!reporting && <button className="linkbtn dim" onClick={() => setReporting(true)}>Report a problem</button>}
        </div>
        {reporting && <Report card={card} url={url} onDone={() => setReporting(false)} />}
      </div>
    </div>
  );
}
