"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Cited } from "@/components/Explainer";
import type { Card } from "@/components/ContextCard";
import { log } from "@/lib/store";

type Claim = { text: string; quote: string; from: "primary" | "reporting" };
type Item = { url: string; headline: string; changed: Claim[]; affects: Claim[]; sources: Card["sources"] };
type Week = { weekOf: string; weekEnd: string; items: Item[] };
const fmt = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

export default function WeekView() {
  const [w, setW] = useState<Week | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    fetch("/api/week").then((r) => r.json()).then((j) => { setW(j.week ?? null); if (j.week) log("page_view", { page: "week" }); }).catch(() => setW(null));
  }, []);
  let n = 1;
  return (
    <main className="narrow" style={{ paddingTop: 36 }}>
      <h1 className="page-title">This week in tech</h1>
      {w && <p className="fine" style={{ margin: "0 0 6px" }}>Week of {fmt(w.weekOf)} to {fmt(w.weekEnd)}</p>}
      <p className="lede" style={{ marginTop: 0 }}>Three changes worth knowing about, and who each one affects. Every sentence links to the passage it comes from.</p>
      <div className="actions" style={{ marginBottom: 8 }}>
        <button className="ghost" onClick={async () => { try { await navigator.clipboard.writeText(location.href); setCopied(true); log("share", { page: "week" }); setTimeout(() => setCopied(false), 2000); } catch {} }}>{copied ? "Link copied" : "Share this roundup"}</button>
      </div>
      {w === undefined && <p className="skeleton" role="status">Putting this week together. The first load can take about 30 seconds.</p>}
      {w === null && <p className="empty">This week&rsquo;s roundup isn&rsquo;t ready yet. <Link href="/">Go to today&rsquo;s news</Link>.</p>}
      {w?.items.map((it) => {
        const card = { sources: it.sources } as Card;
        const s1 = n; n += it.changed.length;
        const s2 = n; n += it.affects.length;
        return (
          <article className="row" key={it.url}>
            <h2 style={{ fontWeight: 800, fontSize: 24, lineHeight: 1.2, margin: "0 0 12px", letterSpacing: "-0.02em" }}>{it.headline}</h2>
            <h3 className="wk-h">What changed</h3>
            <Cited claims={it.changed} card={card} start={s1} />
            <h3 className="wk-h">Who it affects</h3>
            {it.affects.length ? <Cited claims={it.affects} card={card} start={s2} /> : <p>The reporting does not say.</p>}
            <div className="actions" style={{ marginTop: 12 }}>
              <Link className="btn" href={`/story?u=${encodeURIComponent(it.url)}`}>Read the story</Link>
            </div>
          </article>
        );
      })}
    </main>
  );
}
