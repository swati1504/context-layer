"use client";
import { useEffect, useRef, useState } from "react";
import { log, storyLink } from "@/lib/store";

export function ShareIcon({ url, title, label = "Share this story" }: { url: string; title: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function go() {
    const link = storyLink(url);
    try {
      if (typeof navigator.share === "function") { await navigator.share({ title, url: link }); log("share", { url, via: "native" }); return; }
      await navigator.clipboard.writeText(link);
      log("share", { url, via: "copy" });
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {}
  }
  return (
    <button type="button" className="iconbtn sharebtn" onClick={go} aria-label={done ? "Link copied" : label} title={done ? "Link copied" : label}>
      {done ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.2 3L13 4.5" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 10.5V2.5M5 5l3-2.8L11 5" /><path d="M3 8v4.5a1 1 0 001 1h8a1 1 0 001-1V8" /></svg>
      )}
    </button>
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
