"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COMFORT, INDUSTRIES, INTERESTS, ROLES, openProfile, saveProfile, useProfile, type Profile } from "@/lib/profile";
import { isStudy, log, pid } from "@/lib/store";

const LINKS = [
  { href: "/", label: "Feed" },
  { href: "/week", label: "This week" },
  { href: "/community", label: "Community" },
  { href: "/saved", label: "Saved" },
  { href: "/pricing", label: "Pricing" },
  { href: "/welcome", label: "About" },
];

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="1" y="1" width="20" height="20" rx="5" fill="var(--ink)" />
      <rect x="5" y="12" width="12" height="4" rx="1" fill="var(--mark)" />
      <rect x="5" y="6.5" width="9" height="1.5" rx="0.75" fill="var(--ink-fg)" />
    </svg>
  );
}

function ProfileModal({ onClose, opener }: { onClose: () => void; opener: HTMLElement | null }) {
  const existing = useProfile();
  const [p, setP] = useState<Profile>({ interests: [], role: "", industry: "", comfort: "beginner" });
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (existing) setP(existing); }, [existing]);
  useEffect(() => {
    first.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function close() { onClose(); setTimeout(() => opener?.focus?.(), 0); }
  const toggle = (i: string) => setP((q) => ({ ...q, interests: q.interests.includes(i) ? q.interests.filter((x) => x !== i) : [...q.interests, i] }));
  const ok = p.interests.length > 0;
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && close()}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="pm-h" onSubmit={(e) => { e.preventDefault(); if (!ok) return; saveProfile(p); log("profile_complete", { interests: p.interests, role: p.role, industry: p.industry, comfort: p.comfort }); close(); }}>
        <h2 id="pm-h">Make your feed yours</h2>
        <p>Pick what you care about. We rank stories for you and always say why.</p>
        <div className="field">
          <label id="pm-int">What do you want to understand? <span className="opt">Pick any</span></label>
          <div className="ichips" role="group" aria-labelledby="pm-int">
            {Object.keys(INTERESTS).map((i, n) => (
              <button type="button" key={i} ref={n === 0 ? first : undefined} className="ichip" aria-pressed={p.interests.includes(i)} onClick={() => toggle(i)}>{i}</button>
            ))}
          </div>
        </div>
        <div className="two field">
          <div>
            <label htmlFor="pm-role">Your role <span className="opt">Optional</span></label>
            <select id="pm-role" value={p.role} onChange={(e) => setP({ ...p, role: e.target.value })}>
              <option value="">Skip</option>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pm-ind">Your industry <span className="opt">Optional</span></label>
            <select id="pm-ind" value={p.industry} onChange={(e) => setP({ ...p, industry: e.target.value })}>
              <option value="">Skip</option>
              {INDUSTRIES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <fieldset className="field radios">
          <legend>How comfortable are you with tech news?</legend>
          {COMFORT.map((c) => (
            <label className="radio" key={c.v}>
              <input type="radio" name="comfort" checked={p.comfort === c.v} onChange={() => setP({ ...p, comfort: c.v })} />
              <span>{c.label}<small>{c.hint}</small></span>
            </label>
          ))}
        </fieldset>
        <div className="modal-acts">
          <button type="button" className="btn sec-btn" onClick={() => { log("prompt_dismissed"); close(); }}>Not now</button>
          <button className="btn" disabled={!ok}>Save my picks</button>
        </div>
        <p className="privacy">No account needed. Your picks stay in this browser.</p>
      </form>
    </div>
  );
}

export default function Header() {
  const path = usePathname();
  const profile = useProfile();
  const [theme, setTheme] = useState("light");
  const [open, setOpen] = useState(false);
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const openRef = useRef(false);
  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme ?? "light");
    const o = () => { setOpener(document.activeElement as HTMLElement); setOpen(true); };
    window.addEventListener("cl-open-profile", o);
    pid();
    if (!path.startsWith("/admin")) {
      log("page_view", { path });
      try {
        const last = localStorage.getItem("cl_last_visit");
        const now = Date.now();
        if (last && now - Number(last) > 6 * 36e5) log("return_visit", { hoursSince: Math.round((now - Number(last)) / 36e5) });
        localStorage.setItem("cl_last_visit", String(now));
      } catch {}
    }
    return () => window.removeEventListener("cl-open-profile", o);
  }, [path]);

  // First visit: about 3 seconds after landing, offer to personalize (never in study mode, never twice).
  useEffect(() => {
    if (path !== "/") return;
    const t = setTimeout(() => {
      try {
        if (isStudy() || localStorage.getItem("cl_profile") || localStorage.getItem("cl_prompted") || openRef.current) return;
        localStorage.setItem("cl_prompted", "1");
        log("prompt_shown");
        setOpener(null);
        setOpen(true);
      } catch {}
    }, 3000);
    return () => clearTimeout(t);
  }, [path]);

  function flip() {
    const t = theme === "dark" ? "light" : "dark";
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("cl_theme", t); } catch {}
    log("theme_change", { theme: t });
  }

  const cur = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  const n = profile?.interests.length ?? 0;
  return (
    <>
      <header className="hdr">
        <div className="hdr-in">
          <Link href="/" className="logo"><Logo /><span>Context Layer</span></Link>
          <nav className="nav" aria-label="Main">
            {LINKS.map((l) => <Link key={l.href} href={l.href} aria-current={cur(l.href) ? "page" : undefined}>{l.label}</Link>)}
          </nav>
          <div className="hdr-right">
            <button className="pill" onClick={openProfile}>{n > 0 ? `Your picks (${n})` : "Personalize"}</button>
            <button className="iconbtn" onClick={flip} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} title="Switch theme">
              {theme === "dark" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
              )}
            </button>
          </div>
        </div>
        <nav className="mobnav" aria-label="Main mobile">
          {LINKS.map((l) => <Link key={l.href} href={l.href} aria-current={cur(l.href) ? "page" : undefined}>{l.label}</Link>)}
        </nav>
      </header>
      {open && <ProfileModal onClose={() => setOpen(false)} opener={opener} />}
    </>
  );
}
