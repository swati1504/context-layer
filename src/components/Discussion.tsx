"use client";
import { useCallback, useEffect, useState } from "react";
import { log } from "@/lib/store";

type C = { id: string; parent: string | null; name: string; body: string; ts: string };
const ERR: Record<string, string> = {
  bad_code: "That invite code isn't right.",
  bad_name: "Pick a display name between 2 and 24 characters.",
  bad_body: "Comments need 2 to 280 characters.",
  no_links: "Links are not allowed in comments.",
  slow_down: "Slow down a little and try again in a minute.",
  closed: "Posting isn't open yet.",
  server: "Could not post that. Try again.",
  bad_request: "Could not post that. Try again.",
};
const get = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };
const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - +new Date(iso)) / 60000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export function Form({ url, title, parent, onPosted, onCancel, placeholder, needsCode }: { url: string; title: string; parent?: string; onPosted: (c: C) => void; onCancel?: () => void; placeholder: string; needsCode?: boolean }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasCode, setHasCode] = useState(false);
  useEffect(() => { setName(get("cl_name")); setCode(get("cl_code")); setHasCode(!!get("cl_code")); }, []);
  async function post(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, title, name, code, body, parent: parent ?? null }) });
      const j = await r.json();
      if (!r.ok) { setErr(ERR[j.error] ?? ERR.server); return; }
      put("cl_name", name.trim()); put("cl_code", code.trim());
      log("comment_post", { url, reply: !!parent });
      setBody("");
      onPosted(j.comment);
    } catch { setErr(ERR.server); } finally { setBusy(false); }
  }
  return (
    <form className="cform" onSubmit={post}>
      <div className="crow">
        <label>Display name<input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} autoComplete="nickname" /></label>
        {needsCode && !hasCode && <label>Invite code<input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" /></label>}
      </div>
      <p className="fine" style={{ margin: "0 0 8px" }}>Your display name appears publicly. A nickname is fine.</p>
      <textarea aria-label="Your comment" placeholder={placeholder} maxLength={280} rows={parent ? 2 : 3} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="actions" style={{ marginTop: 8 }}>
        <button className="btn" disabled={busy || body.trim().length < 2 || name.trim().length < 2 || (!!needsCode && !code.trim())}>{busy ? "Posting…" : parent ? "Reply" : "Post comment"}</button>
        {onCancel && <button type="button" className="quiet" onClick={onCancel}>Cancel</button>}
        <span className="fine">{280 - body.length} characters left</span>
      </div>
      {err && <p className="err" role="alert" style={{ margin: "8px 0 0" }}>{err}</p>}
    </form>
  );
}

export default function Discussion({ url, title, heading = "Discussion", prompt = "What do you think about this story?", note = "Reader opinions · not part of the reporting." }: { url: string; title: string; heading?: string; prompt?: string; note?: string }) {
  const [list, setList] = useState<C[] | null>(null);
  const [open, setOpen] = useState(true);
  const [needsCode, setNeedsCode] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const load = useCallback(() => {
    fetch("/api/comments?u=" + encodeURIComponent(url)).then((r) => r.json()).then((j) => { setList(j.comments ?? []); setOpen(j.open !== false); setNeedsCode(!!j.needsCode); }).catch(() => setList([]));
  }, [url]);
  useEffect(() => { load(); }, [load]);
  const tops = (list ?? []).filter((c) => !c.parent);
  const kids = (id: string) => (list ?? []).filter((c) => c.parent === id);
  return (
    <section className="disc" id="discussion" aria-label="Discussion">
      <h2>{heading}{list && list.length > 0 ? ` (${list.length})` : ""}</h2>
      <p className="fine">{note}</p>
      {list && list.length === 0 && <p className="empty" style={{ margin: "12px 0" }}>No comments yet. Start the conversation.</p>}
      {tops.map((c) => (
        <div className="cmt" key={c.id}>
          <p className="cmeta"><strong>{c.name}</strong> <span>{ago(c.ts)}</span></p>
          <p className="cbody">{c.body}</p>
          {open && <button className="linkbtn" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>Reply</button>}
          {kids(c.id).map((k) => (
            <div className="cmt reply" key={k.id}>
              <p className="cmeta"><strong>{k.name}</strong> <span>{ago(k.ts)}</span></p>
              <p className="cbody">{k.body}</p>
            </div>
          ))}
          {replyTo === c.id && <Form needsCode={needsCode} url={url} title={title} parent={c.id} placeholder="Write a reply" onCancel={() => setReplyTo(null)} onPosted={(n) => { setList((l) => [...(l ?? []), n]); setReplyTo(null); }} />}
        </div>
      ))}
      {open ? (
        <Form needsCode={needsCode} url={url} title={title} placeholder={prompt} onPosted={(n) => setList((l) => [...(l ?? []), n])} />
      ) : <p className="fine">Posting isn&rsquo;t open yet. You can read the discussion here.</p>}
    </section>
  );
}
