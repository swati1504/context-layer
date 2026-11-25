"use client";
import Link from "next/link";
import { useState } from "react";
import ContextCard from "@/components/ContextCard";
import { useFavs } from "@/lib/store";

export default function Saved() {
  const favs = useFavs();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <main className="narrow">
      <h1 className="page-title">Saved</h1>
      <p className="lede">Cards you saved. They are kept on this device.</p>
      <div className="list">
        {favs.length === 0 && (
          <p className="empty">Nothing saved yet. Open a card on the <Link href="/">feed</Link> and choose Save.</p>
        )}
        {favs.map((f) => (
          <article className="row" key={f.url}>
            <div className="meta"><span>{f.source}</span><span>Saved {new Date(f.savedAt).toLocaleDateString()}</span></div>
            <h3>{f.title}</h3>
            <div className="actions">
              <button className="ghost" aria-expanded={open === f.url} onClick={() => setOpen(open === f.url ? null : f.url)}>{open === f.url ? "Hide card" : "Open card"}</button>
            </div>
            {open === f.url && <ContextCard card={f.card} url={f.url} />}
          </article>
        ))}
      </div>
    </main>
  );
}
