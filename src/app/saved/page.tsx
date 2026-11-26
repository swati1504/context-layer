"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import StoryImage from "@/components/StoryImage";
import { copyShare, removeFav, restoreFav, useFavs, type Fav } from "@/lib/store";

export default function Saved() {
  const favs = useFavs();
  const [undo, setUndo] = useState<Fav | null>(null);
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  function remove(f: Fav) {
    removeFav(f.url);
    setUndo(f);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setUndo(null), 6000);
  }
  return (
    <main className="narrow">
      <h1 className="page-title">Saved</h1>
      <p className="lede">Stories you saved, with the short version so you can find them again. They are kept in this browser.</p>
      <div>
        {favs.length === 0 && <p className="empty">Nothing saved yet. Open a story on the <Link href="/">feed</Link> and choose Save.</p>}
        {favs.map((f) => (
          <article className="srow savedrow" key={f.url}>
            <div className="saved-img"><StoryImage size="thumb" seed={f.url} text={f.title + " " + (f.card?.v === 2 ? f.card.summary.text : "")} credit={false} /></div>
            <div>
            <div className="meta"><span>{f.source}</span><span className="dot">·</span><span>Saved {new Date(f.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></div>
            <h3>{f.card?.v === 2 ? f.card.headline : f.title}</h3>
            {f.card?.v === 2 && <p>{f.card.summary.text}</p>}
            <div className="actions">
              <Link className="ghost" style={{ textDecoration: "none" }} href={`/story?u=${encodeURIComponent(f.url)}`} aria-label={`Open story: ${f.title}`}>Open story</Link>
              <button className="quiet" onClick={async () => { setMsg((await copyShare(f.url)) ? "Link copied" : "Could not copy"); setTimeout(() => setMsg(""), 2200); }} aria-label={`Share: ${f.title}`}>Share</button>
              <button className="quiet" onClick={() => remove(f)} aria-label={`Remove from Saved: ${f.title}`}>Remove from Saved</button>
            </div>
            </div>
          </article>
        ))}
      </div>
      {(undo || msg) && (
        <div className="toast" role="status">
          {msg || "Removed from Saved."}
          {undo && !msg && <button onClick={() => { restoreFav(undo); setUndo(null); }}>Undo</button>}
        </div>
      )}
    </main>
  );
}
