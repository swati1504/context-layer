"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { canRename, getMine, rename, useHandle, type Mine } from "@/lib/handle";
import { useFavs } from "@/lib/store";
import { useProfile } from "@/lib/profile";

export default function Me() {
  const handle = useHandle();
  const favs = useFavs();
  const profile = useProfile();
  const [mine, setMine] = useState<Mine[]>([]);
  const [val, setVal] = useState("");
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => setMine(getMine()), []);
  return (
    <main className="narrow" style={{ paddingTop: 36 }}>
      <p className="fine" style={{ margin: "0 0 16px" }}><Link href="/community">← Community</Link></p>
      <h1 className="page-title">{handle || "Your profile"}</h1>
      <p className="lede" style={{ marginTop: 0 }}>This name was picked for you and is saved in this browser. There is no account, so clearing your browser data starts you fresh.</p>
      {canRename() ? (
        editing ? (
          <form className="crow" onSubmit={(e) => { e.preventDefault(); if (!rename(val)) setErr("Use 2 to 24 letters or numbers."); else { setEditing(false); setErr(""); } }}>
            <label>New name (you can change it once)<input value={val} maxLength={24} onChange={(e) => setVal(e.target.value)} /></label>
            <button className="btn">Save name</button>
            <button type="button" className="quiet" onClick={() => setEditing(false)}>Cancel</button>
          </form>
        ) : <button className="ghost" onClick={() => { setVal(handle); setEditing(true); }}>Change name (once)</button>
      ) : <p className="fine">You have used your one name change.</p>}
      {err && <p className="err" role="alert">{err}</p>}

      <h2 className="feed-head" style={{ marginTop: 40 }}>Your comments</h2>
      {mine.length === 0 && <p className="empty">No comments yet. Join a conversation from the community page or any story.</p>}
      {mine.map((m) => (
        <article className="row" key={m.id}>
          <p style={{ margin: "0 0 6px" }}>{m.body}</p>
          <p className="fine" style={{ margin: 0 }}>{m.url.startsWith("community:") ? <Link href="/community">Open discussion</Link> : <Link href={`/story?u=${encodeURIComponent(m.url)}#discussion`}>{m.title || "Story"}</Link>}</p>
        </article>
      ))}

      <h2 className="feed-head" style={{ marginTop: 40 }}>Saved stories</h2>
      {favs.length === 0 ? <p className="empty">Nothing saved yet.</p> : favs.slice(0, 8).map((f) => (
        <article className="row" key={f.url}><h3 style={{ fontSize: 18 }}><Link href={`/story?u=${encodeURIComponent(f.url)}`}>{f.card?.headline ?? f.title}</Link></h3></article>
      ))}

      <h2 className="feed-head" style={{ marginTop: 40 }}>Your interests</h2>
      {profile?.interests.length ? <ul className="tags">{profile.interests.map((i) => <li key={i}>{i}</li>)}</ul> : <p className="empty">None picked yet. Use “Your picks” in the header.</p>}
    </main>
  );
}
