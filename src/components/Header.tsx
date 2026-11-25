"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { COMFORT, INDUSTRIES, ROLES, openProfile, saveProfile, useProfile, type Profile } from "@/lib/profile";
import { isStudy, log, pid } from "@/lib/store";

const LINKS = [
  { href: "/", label: "Feed" },
  { href: "/saved", label: "Saved" },
  { href: "/verify", label: "How we verify" },
  { href: "/pricing", label: "Pricing" },
];

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="2" y="12" width="20" height="10" rx="3" fill="var(--peri)" opacity="0.55" />
      <rect x="4" y="6" width="20" height="10" rx="3" fill="var(--amber)" />
      <rect x="6" y="9" width="9" height="2" rx="1" fill="var(--on-amber)" opacity="0.7" />
    </svg>
  );
}

function ProfileModal({ onClose }: { onClose: () => void }) {
  const existing = useProfile();
  const [p, setP] = useState<Profile>({ role: "", industry: "", comfort: "beginner" });
  useEffect(() => { if (existing) setP(existing); }, [existing]);
  const ok = p.role && p.industry;
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="pm-h" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={(e) => { e.preventDefault(); if (!ok) return; saveProfile(p); log("profile_complete", { role: p.role, industry: p.industry, comfort: p.comfort }); onClose(); }}>
        <h2 id="pm-h">Make it yours</h2>
        <p>Three quick questions so every story explains why it matters to you. Saved on this device only.</p>
        <div className="field">
          <label htmlFor="pm-role">Your role</label>
          <select id="pm-role" value={p.role} onChange={(e) => setP({ ...p, role: e.target.value })}>
            <option value="">Choose one</option>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pm-ind">Your industry</label>
          <select id="pm-ind" value={p.industry} onChange={(e) => setP({ ...p, industry: e.target.value })}>
            <option value="">Choose one</option>
            {INDUSTRIES.map((r) => <option key={r}>{r}</option>)}
          </select>
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
          <button type="button" className="btn sec-btn" onClick={onClose}>Not now</button>
          <button className="btn" disabled={!ok}>Save profile</button>
        </div>
      </form>
    </div>
  );
}

export default function Header() {
  const path = usePathname();
  const profile = useProfile();
  const [theme, setTheme] = useState("dark");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme ?? "dark");
    const o = () => setOpen(true);
    window.addEventListener("cl-open-profile", o);
    // visit tracking for the study (page view, return visit)
    const study = isStudy();
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
    void study;
    return () => window.removeEventListener("cl-open-profile", o);
  }, [path]);

  function flip() {
    const t = theme === "dark" ? "light" : "dark";
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("cl_theme", t); } catch {}
    log("theme_change", { theme: t });
  }

  const cur = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <>
      <header className="hdr">
        <div className="hdr-in">
          <Link href="/" className="logo"><Logo /><span>Context Layer</span></Link>
          <nav className="nav" aria-label="Main">
            {LINKS.map((l) => <Link key={l.href} href={l.href} aria-current={cur(l.href) ? "page" : undefined}>{l.label}</Link>)}
          </nav>
          <div className="hdr-right">
            <button className="pill" onClick={openProfile}>{profile ? `${profile.role}, ${profile.industry}` : "Set up your profile"}</button>
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
      {open && <ProfileModal onClose={() => setOpen(false)} />}
    </>
  );
}
