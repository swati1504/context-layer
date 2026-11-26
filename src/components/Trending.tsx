"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { log } from "@/lib/store";

type Trend = { title: string; url: string; source: string; rank: number; label: string };

export default function Trending() {
  const [items, setItems] = useState<Trend[] | null>(null);
  useEffect(() => {
    let dead = false;
    fetch("/api/trending").then((r) => r.json()).then((j) => !dead && setItems(j.items ?? [])).catch(() => !dead && setItems([]));
    return () => { dead = true; };
  }, []);
  if (items && items.length === 0) return null;
  return (
    <aside className="trend" aria-label="Trending in tech news">
      <h2>Trending in tech news</h2>
      <p className="fine">Each outlet&rsquo;s own most-read list, right now.</p>
      {items === null && <p className="empty">Loading…</p>}
      <ol>
        {items?.slice(0, 10).map((t) => (
          <li key={t.url}>
            <Link href={`/story?u=${encodeURIComponent(t.url)}`} onClick={() => log("trending_click", { url: t.url, source: t.source, rank: t.rank })}>{t.title}</Link>
          </li>
        ))}
      </ol>
    </aside>
  );
}
