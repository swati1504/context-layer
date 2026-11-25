"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { log } from "@/lib/store";

type Sel = { text: string; x: number; top: number; bottom: number };
type Pop = Sel & { state: "load" | "done" | "err"; out?: string; covered?: boolean };

// Select any words inside this block and get a plain-English explanation grounded in the story's source passages.
export default function Explainable({ children, facts, headline, url }: { children: ReactNode; facts: string[]; headline: string; url: string }) {
  const box = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<Sel | null>(null);
  const [pop, setPop] = useState<Pop | null>(null);

  useEffect(() => {
    function read() {
      const s = window.getSelection();
      if (!s || s.isCollapsed || s.rangeCount === 0 || !box.current) { setSel(null); return; }
      const r = s.getRangeAt(0);
      if (!box.current.contains(r.commonAncestorContainer)) { setSel(null); return; }
      const text = s.toString().replace(/\s+/g, " ").trim();
      if (text.length < 3 || text.length > 300) { setSel(null); return; }
      const b = r.getBoundingClientRect();
      setSel({ text, x: b.left + b.width / 2, top: b.top, bottom: b.bottom });
    }
    const down = (e: MouseEvent) => { if (popRef.current && !popRef.current.contains(e.target as Node)) setPop(null); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setPop(null); };
    document.addEventListener("selectionchange", read);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", read, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", read);
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", read);
    };
  }, []);

  async function explain() {
    if (!sel) return;
    const at = sel;
    setPop({ ...at, state: "load" });
    setSel(null);
    log("explain_selection", { url, chars: at.text.length });
    try {
      const r = await fetch("/api/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selection: at.text, facts, headline }) });
      const j = await r.json();
      setPop(r.ok ? { ...at, state: "done", out: j.explanation, covered: j.covered } : { ...at, state: "err" });
    } catch { setPop({ ...at, state: "err" }); }
  }

  const clampX = (x: number, w: number) => Math.max(12, Math.min(x - w / 2, window.innerWidth - w - 12));
  return (
    <div ref={box}>
      {children}
      {sel && !pop && (
        <button className="xbtn" style={{ left: Math.max(70, Math.min(sel.x, window.innerWidth - 70)), top: sel.top > 64 ? sel.top - 44 : sel.bottom + 10 }} onMouseDown={(e) => e.preventDefault()} onClick={explain}>
          Explain this
        </button>
      )}
      {pop && (
        <div ref={popRef} className="xpop" role="dialog" aria-label="Explanation" style={{ left: clampX(pop.x, 340), ...(window.innerHeight - pop.bottom > 240 ? { top: pop.bottom + 10 } : { bottom: window.innerHeight - pop.top + 10 }) }}>
          <button className="x" aria-label="Close explanation" onClick={() => setPop(null)}>×</button>
          <q>“{pop.text.length > 90 ? pop.text.slice(0, 87) + "…" : pop.text}”</q>
          {pop.state === "load" && <span>Explaining…</span>}
          {pop.state === "err" && <span>Could not explain that. Try selecting it again.</span>}
          {pop.state === "done" && <>{pop.out}{!pop.covered && <span className="lbl">The article does not cover this. This is a general explanation.</span>}</>}
        </div>
      )}
    </div>
  );
}
