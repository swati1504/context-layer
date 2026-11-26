"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Thread = { url: string; title: string; count: number; latest: { name: string; body: string; ts: string } };
type Story = { url: string; title: string; card?: { headline: string } | null };

export default function Community() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  useEffect(() => {
    fetch("/api/comments").then((r) => r.json()).then((j) => setThreads(j.threads ?? [])).catch(() => setThreads([]));
    fetch("/api/feed").then((r) => r.json()).then((j) => setStories((j.items ?? []).slice(0, 8))).catch(() => {});
  }, []);
  const talked = new Set((threads ?? []).map((t) => t.url));
  const link = (u: string) => `/story?u=${encodeURIComponent(u)}#discussion`;
  return (
    <main className="narrow" style={{ paddingTop: 36 }}>
      <h1 className="page-title">Community</h1>
      <p className="lede" style={{ marginTop: 0 }}>Talk about the stories with other readers. Comments are opinions, separate from the reporting.</p>

      <h2 className="feed-head" style={{ marginTop: 28 }}>Recent conversations</h2>
      {threads === null && <p className="empty">Loading…</p>}
      {threads?.length === 0 && <p className="empty">No conversations yet. Pick a story below and start one.</p>}
      {threads?.map((t) => (
        <article className="row" key={t.url}>
          <h3><Link href={link(t.url)}>{t.title || "Story"}</Link></h3>
          <p className="fine" style={{ margin: "0 0 6px" }}>{t.count} {t.count === 1 ? "comment" : "comments"}</p>
          <p style={{ margin: 0 }}><strong>{t.latest.name}:</strong> {t.latest.body}</p>
        </article>
      ))}

      <h2 className="feed-head" style={{ marginTop: 40 }}>Start a conversation</h2>
      {stories.filter((s) => !talked.has(s.url)).map((s) => (
        <article className="row" key={s.url}>
          <h3 style={{ fontSize: 18 }}><Link href={link(s.url)}>{s.card?.headline ?? s.title}</Link></h3>
        </article>
      ))}
    </main>
  );
}
