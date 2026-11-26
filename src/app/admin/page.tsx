"use client";
import { useState } from "react";

type Stats = Record<string, unknown> & { reports?: Record<string, unknown>[] };

export default function Admin() {
  const [pw, setPw] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [msg, setMsg] = useState("");
  const [built, setBuilt] = useState<{ url: string; status: string; verified?: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [cm, setCm] = useState<{ id: string; title: string; name: string; body: string; hidden: boolean; ts: string }[]>([]);
  async function loadComments() {
    const r = await fetch("/api/admin/comments", { headers: { "x-admin-password": pw } });
    if (r.ok) setCm((await r.json()).comments);
  }
  async function hide(id: string, hidden: boolean) {
    await fetch("/api/admin/comments", { method: "POST", headers: { "x-admin-password": pw, "content-type": "application/json" }, body: JSON.stringify({ id, hidden }) });
    loadComments();
  }

  async function load() {
    setMsg("");
    const r = await fetch("/api/admin/stats", { headers: { "x-admin-password": pw } });
    if (!r.ok) { setMsg(r.status === 401 ? "Wrong password, or ADMIN_PASSWORD is not set in Vercel." : "Could not load stats."); return; }
    setStats(await r.json());
    loadComments();
  }
  async function exportCsv() {
    const r = await fetch("/api/admin/export", { headers: { "x-admin-password": pw } });
    if (!r.ok) { setMsg("Could not export."); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await r.blob());
    a.download = "context-layer-events.csv";
    a.click();
  }
  async function prebuild() {
    setBusy(true); setBuilt(null);
    const r = await fetch("/api/admin/prebuild", { method: "POST", headers: { "x-admin-password": pw, "content-type": "application/json" }, body: JSON.stringify({ count: 8 }) });
    setBusy(false);
    if (!r.ok) { setMsg("Pre-build failed."); return; }
    setBuilt((await r.json()).results);
  }

  return (
    <main className="narrow">
      <h1 className="page-title">Admin</h1>
      <form className="paste" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <input type="password" aria-label="Admin password" placeholder="Admin password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="btn">Load</button>
      </form>
      {msg && <p className="err">{msg}</p>}

      {stats && (
        <>
          <h2 className="feed-head" style={{ marginTop: 36 }}>All visitors (main app)</h2>
          {(() => {
            const a = stats.app as Record<string, any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
            if (!a) return null;
            const j = (o: unknown) => { const e = Object.entries((o ?? {}) as Record<string, number>); return e.length ? e.map(([k, v]) => `${k}: ${v}`).join(", ") : "none"; };
            return (
              <>
                <div className="box">
                  <div className="kv">
                    <span>Visitors (anonymous browsers)</span><span>{a.visitors}</span>
                    <span>New visitors / sessions / returning</span><span>{a.new_visitors} / {a.sessions} / {a.returning_visitors}</span>
                    <span>Devices</span><span>{j(a.devices)}</span>
                    <span>Previews considered (on screen about 3s, or opened)</span><span>{a.previews_considered}</span>
                    <span>Opened the context or story</span><span>{a.opened_context}</span>
                    <span>Looked and passed</span><span>{a.passed}{a.avg_preview_s_passed !== null ? `, about ${a.avg_preview_s_passed}s on the preview` : ""}</span>
                    <span>Open rate (considered, then opened)</span><span><b>{a.open_rate === null ? "no data yet" : `${a.open_rate}%`}</b></span>
                    <span>Story page visits</span><span>{a.story_reads}</span>
                    <span>Median time on a story</span><span>{a.median_read_s === null ? "no data" : `${Math.round(a.median_read_s)}s`}</span>
                    <span>Read to the end (scrolled 75% or more)</span><span>{a.read_to_end_pct === null ? "no data" : `${a.read_to_end_pct}%`}</span>
                    <span>Clicks out to original articles</span><span>{a.outbound_clicks} ({j(a.outbound_hosts)})</span>
                    <span>Questions asked / highlights / saves / shares</span><span>{a.questions} / {a.highlights} / {a.saves} / {a.shares}</span>
                    <span>Passages opened</span><span>{a.passages_opened}</span>
                    <span>Screenshots uploaded</span><span>{a.screenshots}</span>
                    <span>Errors seen by visitors</span><span>{j(a.errors)}</span>
                  </div>
                </div>
                <p style={{ margin: "14px 0" }}><button className="btn" onClick={exportCsv}>Download all events (CSV)</button> <span className="fine">Internal visits, which you mark by opening the site once with ?internal=1, are left out of these numbers.</span></p>
                <h3 className="feed-head" style={{ fontSize: 18, marginTop: 24 }}>Stories by interest</h3>
                <table className="t"><tbody>{(a.top_stories as { url: string; considered: number; opened: number }[]).map((r) => <tr key={r.url}><td style={{ wordBreak: "break-all" }}>{r.url}</td><td>{r.considered} considered</td><td>{r.opened} opened</td></tr>)}</tbody></table>
                <h3 className="feed-head" style={{ fontSize: 18, marginTop: 24 }}>Each visitor</h3>
                <table className="t"><tbody>{(a.visitor_list as { pid: string; first: string; last: string; device: string; events: number; considered: number; opened: number; read_s: number; questions: number }[]).map((v) => <tr key={v.pid}><td>{v.pid}<br /><span className="fine">{v.device} · first {v.first.slice(0, 16).replace("T", " ")}</span></td><td>{v.events} events</td><td>{v.considered} considered, {v.opened} opened</td><td>{v.read_s}s reading, {v.questions} questions</td></tr>)}</tbody></table>
              </>
            );
          })()}

          <h2 className="feed-head" style={{ marginTop: 36 }}>Study results</h2>
          <div className="box">
            <div className="kv">
              <span>Supabase connected</span><span>{String(stats.supabase)}</span>
              <span>Participants</span><span>{String(stats.participants)}</span>
              <span>Chose Get context</span><span>{String(stats.get_context_clicks)}</span>
              <span>Continued without</span><span>{String(stats.skips)}</span>
              <span>Context rate (target 60 or more)</span><span><b>{stats.context_rate === null ? "no data yet" : `${stats.context_rate}%`}</b></span>
              <span>Participants who chose context at least once</span><span>{String(stats.participants_who_chose_context)}</span>
              <span>Familiarity answers</span><span>{JSON.stringify(stats.familiarity)}</span>
              <span>Cards generated</span><span>{String(stats.cards_generated)}</span>
              <span>Passages opened</span><span>{String(stats.claims_opened)}</span>
              <span>Still confusing clicks</span><span>{String(stats.simplify_clicks)}</span>
              <span>Profiles completed</span><span>{String(stats.profile_completed)}</span>
              <span>Return visits</span><span>{String(stats.returned)}</span>
              <span>All events</span><span>{String(stats.total_events)}</span>
            </div>
          </div>

          <h2 className="feed-head" style={{ marginTop: 36 }}>Pre-build demo cards</h2>
          <p className="fine">Builds cards for the top 8 feed stories so they open instantly. Takes a minute or two.</p>
          <button className="btn" disabled={busy} onClick={prebuild}>{busy ? "Building…" : "Pre-build top 8 stories"}</button>
          {built && (
            <table className="t"><tbody>{built.map((b) => <tr key={b.url}><td>{b.status}{b.verified ? ` (${b.verified})` : ""}</td><td style={{ wordBreak: "break-all" }}>{b.url}</td></tr>)}</tbody></table>
          )}

          <h2 className="feed-head" style={{ marginTop: 36 }}>Comments</h2>
          {cm.length === 0 ? <p className="fine">No comments yet.</p> : (
            <table className="t"><tbody>{cm.map((c) => (
              <tr key={c.id} style={c.hidden ? { opacity: 0.5 } : undefined}>
                <td><strong>{c.name}</strong>: {c.body}<br /><span className="fine">{c.title}</span></td>
                <td><button className="quiet" onClick={() => hide(c.id, !c.hidden)}>{c.hidden ? "Show" : "Hide"}</button></td>
              </tr>
            ))}</tbody></table>
          )}
          <h2 className="feed-head" style={{ marginTop: 36 }}>Reported claims</h2>
          {(stats.reports ?? []).length === 0 ? <p className="fine">No reports yet.</p> : (
            <table className="t"><tbody>{(stats.reports ?? []).map((r, i) => <tr key={i}><td>{String(r.reason)}</td><td>{String(r.claim)}</td></tr>)}</tbody></table>
          )}
        </>
      )}
    </main>
  );
}
