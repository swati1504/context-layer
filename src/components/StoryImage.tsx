"use client";
import { useEffect, useState } from "react";
import { classify } from "@/lib/interests";
import type { Photo } from "@/lib/photo";

const cache = new Map<string, Photo | null>();

// A topic photo for a story. Falls back to a quiet block with the topic name when no photo is available.
export default function StoryImage({ seed, text, topics, size = "feed", credit = true }: { seed: string; text: string; topics?: string[]; size?: "feed" | "hero" | "thumb"; credit?: boolean }) {
  const topic = (topics && topics[0]) || classify(text)[0] || "general";
  const k = topic + "|" + seed;
  const [p, setP] = useState<Photo | null | undefined>(cache.get(k));
  useEffect(() => {
    if (cache.has(k)) { setP(cache.get(k)); return; }
    let on = true;
    fetch(`/api/photo?topic=${encodeURIComponent(topic)}&seed=${encodeURIComponent(seed)}`).then((r) => r.json()).then((j) => { cache.set(k, j.photo ?? null); if (on) setP(j.photo ?? null); }).catch(() => { if (on) setP(null); });
    return () => { on = false; };
  }, [k, topic, seed]);
  return (
    <figure className={`simg ${size}`}>
      {p ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => { if (p.kind === "source") fetch(`/api/photo?topic=${encodeURIComponent(topic)}&seed=${encodeURIComponent("stock:" + seed)}`).then((r) => r.json()).then((j) => { cache.set(k, j.photo ?? null); setP(j.photo ?? null); }).catch(() => setP(null)); else setP(null); }} />
      ) : (
        <div className="simg-fallback" aria-hidden="true"><span>{topic === "general" ? "Tech" : topic}</span></div>
      )}
      {p && credit && size !== "thumb" && (p.kind === "source"
        ? <figcaption>Image: <a href={p.creditUrl} target="_blank" rel="noopener noreferrer">{p.credit}</a></figcaption>
        : <figcaption>Photo by <a href={p.creditUrl} target="_blank" rel="noopener noreferrer">{p.credit}</a> on <a href="https://unsplash.com/?utm_source=context_layer&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a></figcaption>)}
    </figure>
  );
}
