"use client";
import { useState } from "react";

type Stats = Record<string, unknown> & { reports?: Record<string, unknown>[] };

export default function Admin() {
  const [pw, setPw] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [msg, setMsg] = useState("");
  const [built, setBuilt] = useState<{ url: string; status: string; verified?: string }[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setMsg("");
    const r = await fetch("/api/admin/stats", { headers: { "x-admin-password": pw } });
    if (!r.ok) { setMsg(r.status === 401 ? "Wrong password, or ADMIN_PASSWORD is not set in Vercel." : "Could not load stats."); return; }
    setStats(await r.json());
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

          <h2 className="feed-head" style={{ marginTop: 36 }}>Reported claims</h2>
          {(stats.reports ?? []).length === 0 ? <p className="fine">No reports yet.</p> : (
            <table className="t"><tbody>{(stats.reports ?? []).map((r, i) => <tr key={i}><td>{String(r.reason)}</td><td>{String(r.claim)}</td></tr>)}</tbody></table>
          )}
        </>
      )}
    </main>
  );
}
