"use client";
import { useEffect, useState } from "react";
import { openProfile, useProfile } from "@/lib/profile";
import { getReported, log, markReported, pid, toggleFav, useFavs } from "@/lib/store";

export type Claim = { text: string; quote: string };
export type Card = {
  headline: string;
  whats_new: Claim[];
  how_it_works: Claim[];
  perspectives?: { who: string; stance: string; quote: string }[];
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

function ClaimItem({ text, quote, url, section }: { text: string; quote: string; url: string; section: string }) {
  const [show, setShow] = useState(false);
  const [rep, setRep] = useState<"idle" | "form" | "done">("idle");
  const key = url + "|" + text.slice(0, 40);
  useEffect(() => { if (getReported().includes(key)) setRep("done"); }, [key]);
  const link = fragmentUrl(url, quote);

  async function report(reason: string) {
    setRep("done");
    markReported(key);
    log("report", { url, section, reason });
    fetch("/api/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, claim: text, reason, pid: pid() }) }).catch(() => {});
  }

  return (
    <div className="claim">
      <p>{text}</p>
      <div className="claim-acts">
        <button className="linkbtn" aria-expanded={show} onClick={() => { setShow(!show); if (!show) log("claim_opened", { url, section }); }}>
          {show ? "Hide the passage" : "Show where this comes from"}
        </button>
        {rep === "idle" && <button className="linkbtn dim" onClick={() => setRep("form")}>Report a wrong claim</button>}
        {rep === "done" && <span className="under-review">Reported. This claim is under review.</span>}
      </div>
      {rep === "form" && (
        <div className="define" role="group" aria-label="Why is this claim wrong?">
          <b>What is wrong with it?</b>
          <div className="claim-acts" style={{ marginTop: 8 }}>
            {["It is not in the article", "It is misleading", "It is out of date"].map((r) => <button key={r} className="quiet" onClick={() => report(r)}>{r}</button>)}
            <button className="linkbtn dim" onClick={() => setRep("idle")}>Cancel</button>
          </div>
        </div>
      )}
      {show && (
        <>
          <p className="quote">{quote}</p>
          {link && <a className="linkbtn" href={link} target="_blank" rel="noopener noreferrer">Open the article at this passage</a>}
        </>
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

function WhyItMatters({ card, url }: { card: Card; url: string }) {
  const profile = useProfile();
  const [line, setLine] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const pkey = profile ? `cl_why|${url}|${profile.role}|${profile.industry}|${profile.comfort}` : "";

  useEffect(() => {
    setLine(null); setErr(false);
    if (!profile) return;
    try { const c = localStorage.getItem(pkey); if (c) { setLine(c); return; } } catch {}
    let dead = false;
    fetch("/api/personalize", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile, headline: card.headline, claims: [...card.whats_new, ...card.how_it_works].map((c) => c.text) }),
    }).then((r) => r.json()).then((j) => {
      if (dead) return;
      if (j.line) { setLine(j.line); try { localStorage.setItem(pkey, j.line); } catch {} } else setErr(true);
    }).catch(() => !dead && setErr(true));
    return () => { dead = true; };
  }, [profile, pkey, card]);

  return (
    <div className="sec">
      <h5>Why it matters to you</h5>
      {!profile && (
        <div className="why">
          <p style={{ margin: "0 0 10px" }}>Tell us your role and industry and we will explain what this could mean for you.</p>
          <button className="ghost" onClick={openProfile}>Set up your profile</button>
        </div>
      )}
      {profile && !line && !err && <p className="skeleton" style={{ marginTop: 0 }}>Writing this for you…</p>}
      {profile && err && <p className="err" style={{ marginTop: 0 }}>Could not write this right now. Reopen the card to try again.</p>}
      {profile && line && <div className="why">{line}<small>Written for your profile ({profile.role}, {profile.industry}). Based only on the verified claims above.</small></div>}
    </div>
  );
}

export default function ContextCard({ card, url, onShare }: { card: Card; url: string; onShare?: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const favs = useFavs();
  const isFav = favs.some((f) => f.url === url);
  const src = card.source.url || url;
  const v = card.verification;
  const sides = card.perspectives ?? [];
  const quoteFor = (term: string) =>
    [...card.how_it_works, ...card.whats_new].find((c) => (c.text + c.quote).toLowerCase().includes(term.toLowerCase()))?.quote ??
    card.how_it_works[0]?.quote ?? card.whats_new[0]?.quote ?? "";

  return (
    <div className="card">
      <h4>{card.headline}</h4>
      <span className="proof">{v.verified} of {v.total} claims verified against the article</span>
      {v.dropped > 0 && <p className="removed">{v.dropped} {v.dropped === 1 ? "claim was" : "claims were"} left out because we could not find {v.dropped === 1 ? "it" : "them"} in the article.</p>}

      <div className="sec">
        <h5>What&rsquo;s new</h5>
        {card.whats_new.map((c, i) => <ClaimItem key={i} text={c.text} quote={c.quote} url={src} section="whats_new" />)}
      </div>

      <div className="sec">
        <h5>How it works</h5>
        {card.how_it_works.map((c, i) => <ClaimItem key={i} text={c.text} quote={c.quote} url={src} section="how_it_works" />)}
        {card.how_it_works.length > 0 && <Simpler url={src} subject="How it works" text={card.how_it_works.map((c) => c.text).join(" ")} quote={card.how_it_works.map((c) => c.quote).join(" ")} />}
        {card.jargon.length > 0 && (
          <>
            <div className="chips">
              {card.jargon.map((j) => (
                <button key={j.term} className="chip" aria-expanded={open === j.term} onClick={() => { setOpen(open === j.term ? null : j.term); log("section_open", { url: src, section: "jargon", term: j.term }); }}>{j.term}</button>
              ))}
            </div>
            {card.jargon.filter((j) => j.term === open).map((j) => (
              <div key={j.term}>
                <p className="define"><b>{j.term}:</b> {j.plain}</p>
                <Simpler url={src} subject={j.term} text={j.plain} quote={quoteFor(j.term)} />
              </div>
            ))}
          </>
        )}
      </div>

      <WhyItMatters card={card} url={url} />

      <div className="sec">
        <h5>Different sides</h5>
        {sides.length === 0 && <p style={{ margin: 0, color: "var(--muted)" }}>This article reports one account of the story. No other position is quoted in it.</p>}
        {sides.map((p, i) => (
          <div className="side" key={i}>
            <b>{p.who}</b>
            <ClaimItem text={p.stance} quote={p.quote} url={src} section="perspective" />
          </div>
        ))}
      </div>

      <div className="foot">
        <span className="grow">Source: {card.source.name}{src ? <> &ndash; <a href={src} target="_blank" rel="noopener noreferrer">read the original</a></> : null}</span>
        <button className="quiet" aria-pressed={isFav} onClick={() => { const on = toggleFav({ url, title: card.headline, source: card.source.name, card }); log("favorite", { url, on }); }}>{isFav ? "Saved" : "Save"}</button>
        {onShare && <button className="quiet" onClick={onShare}>Share</button>}
      </div>
    </div>
  );
}
