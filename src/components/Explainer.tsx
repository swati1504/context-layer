"use client";
import { useEffect, useState } from "react";
import { fragmentUrl, type Card, type Claim } from "@/components/ContextCard";
import { log } from "@/lib/store";

type Section = { heading: string; claims: Claim[]; background: string | null };
type Faq = { question: string; answers: Claim[]; answered: boolean };
type Ex = { sections: Section[]; faq: Faq[] };
type Qa = { q: string; state: "load" | "done" | "err"; answered?: boolean; parts?: Claim[]; background?: string | null; msg?: string };

const LIMIT = 5;
const BG = "General background · separate from the reporting.";

function srcFor(card: Card, c: Claim) {
  const s = card.sources.find((x) => x.kind === c.from) ?? card.sources[card.sources.length - 1];
  return { name: s?.name ?? "", href: fragmentUrl(s?.url ?? "", c.quote) };
}

// Sentences read as a paragraph; each one ends with a numbered link to the passage it comes from.
function Cited({ claims, card, start }: { claims: Claim[]; card: Card; start: number }) {
  return (
    <p className="cited">
      {claims.map((c, i) => {
        const s = srcFor(card, c);
        return (
          <span key={i}>
            {c.text}
            {s.href && <a className="cite" href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`Source ${start + i} in ${s.name}: ${c.text.slice(0, 60)}`} title={`Read in ${s.name}`}>{start + i}</a>}{" "}
          </span>
        );
      })}
    </p>
  );
}

function Assistant({ url, card, suggestions }: { url: string; card: Card; suggestions: string[] }) {
  const key = "cl_ask_" + url;
  const [used, setUsed] = useState(0);
  const [q, setQ] = useState("");
  const [log2, setLog2] = useState<Qa[]>([]);
  useEffect(() => { try { setUsed(Number(localStorage.getItem(key) ?? 0)); } catch {} }, [key]);
  const left = LIMIT - used;

  async function ask(question: string) {
    const text = question.trim();
    if (text.length < 3 || left <= 0) return;
    setQ("");
    setLog2((l) => [...l, { q: text, state: "load" }]);
    const n = used + 1;
    setUsed(n);
    try { localStorage.setItem(key, String(n)); } catch {}
    log("ask_question", { url, n });
    const upd = (p: Partial<Qa>) => setLog2((l) => l.map((x, i) => (i === l.length - 1 ? { ...x, ...p } : x)));
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, question: text }) });
      const j = await r.json();
      if (!r.ok) return upd({ state: "err", msg: j.error === "limit" ? "The daily limit has been reached. Try again tomorrow." : "Could not answer that. Try again." });
      upd({ state: "done", answered: j.answered, parts: j.parts, background: j.background });
    } catch { upd({ state: "err", msg: "Could not answer that. Try again." }); }
  }

  return (
    <div className="sec assist">
      <h5>Ask a follow-up</h5>
      <p className="fine" style={{ margin: "0 0 10px" }}>Answers come only from this story&rsquo;s sources, with the passage attached. If they don&rsquo;t cover it, we say so.</p>
      {log2.map((x, i) => (
        <div className="qa" key={i}>
          <p className="qa-q">{x.q}</p>
          {x.state === "load" && <p className="skeleton" role="status" style={{ margin: 0 }}>Checking the sources…</p>}
          {x.state === "err" && <p className="err" style={{ margin: 0 }}>{x.msg}</p>}
          {x.state === "done" && x.answered && x.parts && <Cited claims={x.parts} card={card} start={1} />}
          {x.state === "done" && !x.answered && <p style={{ margin: 0 }}>The sources for this story don&rsquo;t answer that.</p>}
          {x.state === "done" && x.background && <p className="bg"><small>{BG}</small>{x.background}</p>}
        </div>
      ))}
      {left > 0 && log2.length === 0 && suggestions.length > 0 && (
        <div className="chips" role="group" aria-label="Suggested questions">
          {suggestions.map((t) => <button type="button" className="chip" key={t} onClick={() => ask(t)}>{t}</button>)}
        </div>
      )}
      {left > 0 ? (
        <form className="paste" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <input aria-label="Your question about this story" placeholder="Does this affect me?" value={q} maxLength={300} onChange={(e) => setQ(e.target.value)} />
          <button className="btn" disabled={q.trim().length < 3}>Ask</button>
        </form>
      ) : <p className="fine">You have used all {LIMIT} questions for this story.</p>}
      {left > 0 && <p className="fine" style={{ margin: "8px 0 0" }}>{left} of {LIMIT} questions left for this story.</p>}
    </div>
  );
}

export default function Explainer({ url, card }: { url: string; card: Card }) {
  const [s, setS] = useState<{ st: "load" | "done" | "err"; ex?: Ex; msg?: string }>({ st: "load" });
  useEffect(() => {
    let dead = false;
    fetch("/api/explainer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) })
      .then(async (r) => ({ ok: r.ok, j: await r.json() }))
      .then(({ ok, j }) => { if (dead) return; if (ok) { setS({ st: "done", ex: j.explainer }); log("explainer_view", { url }); } else setS({ st: "err", msg: j.error === "limit" ? "The daily limit has been reached." : "The full explainer could not be built for this story." }); })
      .catch(() => !dead && setS({ st: "err", msg: "The full explainer could not be built for this story." }));
    return () => { dead = true; };
  }, [url]);

  const secStarts: number[] = [];
  const faqStarts: number[] = [];
  if (s.ex) {
    let n = 1;
    for (const sec of s.ex.sections) { secStarts.push(n); n += sec.claims.length; }
    for (const f of s.ex.faq) { faqStarts.push(n); n += f.answers.length; }
  }
  return (
    <>
      <div className="sec">
        <h5>The full explainer</h5>
        {s.st === "load" && <p className="skeleton" role="status" style={{ marginTop: 0 }}>Writing the full explainer from the sources. This takes about 20 seconds the first time.</p>}
        {s.st === "err" && <p className="fine">{s.msg}</p>}
        {s.ex?.sections.map((sec, i) => (
          <section className="xsec" key={i}>
            <h2>{sec.heading}</h2>
            {sec.claims.length > 0 ? <Cited claims={sec.claims} card={card} start={secStarts[i]} /> : <p>The reporting does not say.</p>}
            {sec.background && <p className="bg"><small>{BG}</small>{sec.background}</p>}
          </section>
        ))}
      </div>
      {s.ex && s.ex.faq.length > 0 && (
        <div className="sec">
          <h5>Go deeper</h5>
          {s.ex.faq.map((f, i) => (
            <details className="faq" key={i}>
              <summary>{f.question}</summary>
              {f.answered ? <Cited claims={f.answers} card={card} start={faqStarts[i]} /> : <p>The sources for this story don&rsquo;t answer that.</p>}
            </details>
          ))}
        </div>
      )}
      <Assistant url={url} card={card} suggestions={[...(s.ex?.faq.map((f) => f.question) ?? []), card.question].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 4)} />
    </>
  );
}
