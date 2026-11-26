"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { log } from "@/lib/store";

export default function Related({ url, title, tags }: { url: string; title: string; tags: string[] }) {
  const [items, setItems] = useState<{ url: string; source: string; title: string }[]>([]);
  const [kind, setKind] = useState<"related" | "more">("related");
  useEffect(() => {
    let dead = false;
    const qs = new URLSearchParams({ u: url, t: title, tags: tags.join(",") });
    fetch("/api/related?" + qs).then((r) => r.json()).then((j) => !dead && (setItems(j.items ?? []), setKind(j.kind === "more" ? "more" : "related"))).catch(() => {});
    return () => { dead = true; };
  }, [url, title, tags]);
  if (!items.length) return null;
  return (
    <section className="related" aria-label="Related stories">
      <h2>{kind === "more" ? "More tech news" : "Related"}</h2>
      <ul>
        {items.map((r) => (
          <li key={r.url}>
            <Link href={`/story?u=${encodeURIComponent(r.url)}`} onClick={() => log("related_click", { from: url, to: r.url })}>{r.title}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
