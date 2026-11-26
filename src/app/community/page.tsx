"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Form } from "@/components/Discussion";

type Thread = { url: string; title: string; count: number; latest: { name: string; body: string; ts: string } };
type Story = { url: string; title: string; card?: { headline: string } | null };

export default function Community() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [pick, setPick] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [done, setDone] = useState("");
  const loadThreads = useCallback(() => {
    fetch("/api/comments").then((r) => r.json()).then((j) => setThreads(j.threads ?? [])).catch(() => setThreads([]));
  }, []);
  useEffect(() => {
    loadThreads();
    fetch("/api/comments?u=" + encodeURIComponent("https://x.invalid/")).then((r) => r.json()).then((j) => setNeedsCode(!!j.needsCode)).catch(() => {});
    fetch("/api/feed").then((r) => r.json()).then((j) => { const it = (j.items ?? []).slice(0, 12); setStories(it); if (it[0]) setPick((p) => p || it[0].url); }).catch(() => {});
  }, [loadThreads]);
  const talked = new Set((threads ?? []).map((t) => t.url));
  const link = (u: string) => `/story?u=${encodeURIComponent(u)}#discussion`;
  return (
    <main className="narrow" style={{ paddingTop: 36 }}>
      <h1 className="page-title">Community</h1>
      <p className="lede" style={{ marginTop: 0 }}>Talk about the stories with other readers. Comments are opinions, separate from the reporting.</p>

      <h2 className="feed-head" style={{ marginTop: 28 }}>Start a discussion</h2>
      <div className="disc-new">
        <label className="fine" htmlFor="story-pick">Pick the story it&rsquo;s about</label>
        <select id="story-pick" value={pick} onChange={(e) => { setPick(e.target.value); setDone(""); }}>
          {stories.map((s) => <option key={s.url} value={s.url}>{s.card?.headline ?? s.title}</option>)}
        </select>
        {pick && (
          <Form key={pick} needsCode={needsCode} url={pick} title={stories.find((s) => s.url === pick)?.card?.headline ?? stories.find((s) => s.url === pick)?.title ?? ""} placeholder="Share your take on this story" onPosted={() => { setDone(pick); loadThreads(); }} />
        )}
        {done && <p className="fine" style={{ margin: "10px 0 0" }}>Posted. <Link href={link(done)}>See it on the story page</Link>.</p>}
      </div>

      <h2 className="feed-head" style={{ marginTop: 40 }}>Recent conversations</h2>
      {threads === null && <p className="empty">Loading…</p>}
      {threads?.length === 0 && <p className="empty">No conversations yet. Pick a story below and start one.</p>}
      {threads?.map((t) => (
        <article className="row" key={t.url}>
          <h3><Link href={link(t.url)}>{t.title || "Story"}</Link></h3>
          <p className="fine" style={{ margin: "0 0 6px" }}>{t.count} {t.count === 1 ? "comment" : "comments"}</p>
          <p style={{ margin: 0 }}><strong>{t.latest.name}:</strong> {t.latest.body}</p>
        </article>
      ))}

      <h2 className="feed-head" style={{ marginTop: 40 }}>More stories to talk about</h2>
      {stories.filter((s) => !talked.has(s.url)).map((s) => (
        <article className="row" key={s.url}>
          <h3 style={{ fontSize: 18 }}><Link href={link(s.url)}>{s.card?.headline ?? s.title}</Link></h3>
        </article>
      ))}
    </main>
  );
}
