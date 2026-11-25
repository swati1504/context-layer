"use client";
import { useState } from "react";

export type Claim = { text: string; quote: string };
export type Card = {
  headline: string;
  whats_new: Claim[];
  how_it_works: Claim[];
  jargon: { term: string; plain: string }[];
  tags: string[];
  verification: { total: number; verified: number; dropped: number };
  source: { name: string; tier: string; url: string };
};

// Opens the original article scrolled to the passage and highlighted (browser text-fragment link).
function fragmentUrl(url: string, quote: string) {
  if (!url) return "";
  const words = quote.replace(/\s+/g, " ").trim().split(" ");
  const enc = (s: string) => encodeURIComponent(s).replace(/-/g, "%2D");
  const frag = words.length <= 8 ? enc(words.join(" ")) : `${enc(words.slice(0, 4).join(" "))},${enc(words.slice(-4).join(" "))}`;
  return `${url}#:~:text=${frag}`;
}

function ClaimItem({ c, url }: { c: Claim; url: string }) {
  const [show, setShow] = useState(false);
  const link = fragmentUrl(url, c.quote);
  return (
    <div className="claim">
      <p>{c.text}</p>
      <button className="linkbtn see" aria-expanded={show} onClick={() => setShow(!show)}>
        {show ? "Hide the passage" : "Show where this comes from"}
      </button>
      {show && (
        <>
          <p className="quote">{c.quote}</p>
          {link && (
            <a className="see" href={link} target="_blank" rel="noopener noreferrer">
              Open the article at this passage
            </a>
          )}
        </>
      )}
    </div>
  );
}

function Simpler({ subject, text, quote }: { subject: string; text: string; quote: string }) {
  const [state, setState] = useState<{ s: "idle" | "load" | "done" | "err"; out?: string }>({ s: "idle" });
  async function go() {
    setState({ s: "load" });
    try {
      const r = await fetch("/api/simplify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject, text, quote }) });
      const j = await r.json();
      setState(r.ok ? { s: "done", out: j.explanation } : { s: "err" });
    } catch {
      setState({ s: "err" });
    }
  }
  return (
    <div style={{ marginTop: 6 }}>
      {state.s !== "done" && (
        <button className="linkbtn" onClick={go} disabled={state.s === "load"}>
          {state.s === "load" ? "Simplifying…" : "Still confusing?"}
        </button>
      )}
      {state.s === "err" && <span className="err"> Could not simplify that. Try again.</span>}
      {state.s === "done" && <p className="define"><b>In simpler words:</b> {state.out}</p>}
    </div>
  );
}

export default function ContextCard({ card }: { card: Card }) {
  const [open, setOpen] = useState<string | null>(null);
  const url = card.source.url;
  const v = card.verification;
  const quoteFor = (term: string) =>
    [...card.how_it_works, ...card.whats_new].find((c) => c.text.toLowerCase().includes(term.toLowerCase()) || c.quote.toLowerCase().includes(term.toLowerCase()))?.quote ??
    card.how_it_works[0]?.quote ?? card.whats_new[0]?.quote ?? "";

  return (
    <div className="card">
      <h4>{card.headline}</h4>
      <span className="proof">{v.verified} of {v.total} claims verified against the article</span>
      {v.dropped > 0 && <p className="removed">{v.dropped} {v.dropped === 1 ? "claim was" : "claims were"} left out because we could not find {v.dropped === 1 ? "it" : "them"} in the article.</p>}

      <div className="sec">
        <h5>What&rsquo;s new</h5>
        {card.whats_new.map((c, i) => <ClaimItem key={i} c={c} url={url} />)}
      </div>

      <div className="sec">
        <h5>How it works</h5>
        {card.how_it_works.map((c, i) => <ClaimItem key={i} c={c} url={url} />)}
        {card.how_it_works.length > 0 && <Simpler subject="How it works" text={card.how_it_works.map((c) => c.text).join(" ")} quote={card.how_it_works.map((c) => c.quote).join(" ")} />}
        {card.jargon.length > 0 && (
          <>
            <div className="chips">
              {card.jargon.map((j) => (
                <button key={j.term} className="chip" aria-expanded={open === j.term} onClick={() => setOpen(open === j.term ? null : j.term)}>
                  {j.term}
                </button>
              ))}
            </div>
            {card.jargon.filter((j) => j.term === open).map((j) => (
              <div key={j.term}>
                <p className="define"><b>{j.term}:</b> {j.plain}</p>
                <Simpler subject={j.term} text={j.plain} quote={quoteFor(j.term)} />
              </div>
            ))}
          </>
        )}
      </div>

      <p className="src">Source: {card.source.name}{url ? <> &mdash; <a href={url} target="_blank" rel="noopener noreferrer">read the original</a></> : null}</p>
    </div>
  );
}
