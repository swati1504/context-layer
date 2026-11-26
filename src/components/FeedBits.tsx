"use client";
import { useEffect, useRef, useState } from "react";
import { log, storyLink } from "@/lib/store";

export function ShareIcon({ url, title, label = "Copy link to share" }: { url: string; title: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function go() {
    const link = storyLink(url);
    let ok = false;
    try { await navigator.clipboard.writeText(link); ok = true; } catch {
      try { const t = document.createElement("textarea"); t.value = link; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); ok = document.execCommand("copy"); t.remove(); } catch {}
    }
    log("share", { url, via: ok ? "copy" : "copy_failed", title: title.slice(0, 80) });
    if (ok) { setDone(true); setTimeout(() => setDone(false), 2200); }
  }
  return (
    <span className="sharewrap">
      <button type="button" className="iconbtn sharebtn" onClick={go} aria-label={done ? "Link copied" : label} title={done ? "Link copied" : label}>
        {done ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" /><path d="M8.3 10.7l7.4-4.2M8.3 13.3l7.4 4.2" /></svg>
        )}
      </button>
      <span className="sharenote" role="status" aria-live="polite">{done ? "Link copied" : ""}</span>
    </span>
  );
}

// A story's key verified passage, shown like a newspaper clipping with a highlighter mark.
export function Clipping({ quote }: { quote: string }) {
  const clean = quote.replace(/\s+/g, " ").trim();
  let text = clean;
  if (text.length > 150) { text = text.slice(0, 150); text = text.slice(0, text.lastIndexOf(" ")) + "…"; }
  const words = text.split(" ");
  const n = Math.min(6, Math.max(3, Math.floor(words.length / 3)));
  const start = Math.floor((words.length - n) / 2);
  return (
    <figure className="clip" aria-label="Key passage from the article">
      <blockquote>
        {words.slice(0, start).join(" ")} <mark>{words.slice(start, start + n).join(" ")}</mark> {words.slice(start + n).join(" ")}
      </blockquote>
      <figcaption>From the article</figcaption>
    </figure>
  );
}

export function WhyThis({ reason, explain }: { reason: string; explain: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const c = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", c); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", c); document.removeEventListener("keydown", k); };
  }, [open]);
  return (
    <span className="why" ref={ref}>
      <button type="button" className="reason" aria-expanded={open} onClick={() => { setOpen(!open); if (!open) log("why_open", { reason }); }}>{reason}</button>
      {open && <span className="whypop" role="note">{explain}</span>}
    </span>
  );
}
