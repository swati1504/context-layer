"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { log } from "@/lib/store";

// Site-wide behaviour logging. Anonymous: a random browser id, no names or emails.
const get = (s: Storage, k: string) => { try { return s.getItem(k); } catch { return null; } };
const put = (s: Storage, k: string, v: string) => { try { s.setItem(k, v); } catch {} };

function device() {
  const w = window.innerWidth;
  return { device: w < 640 ? "phone" : w < 1024 ? "tablet" : "desktop", w, h: window.innerHeight, lang: navigator.language, tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
}

// One-time events: first ever visit in this browser, and the start of each browsing session.
function startEvents(path: string) {
  const q = new URLSearchParams(window.location.search);
  if (q.get("internal") === "1") put(localStorage, "cl_internal", "1");
  if (q.get("internal") === "0") { try { localStorage.removeItem("cl_internal"); } catch {} }
  let ref = "";
  try { ref = document.referrer ? new URL(document.referrer).hostname : ""; } catch {}
  const info = { entry: path, ref, utm: q.get("utm_source") ?? "", ...device() };
  const first = !get(localStorage, "cl_first");
  if (first) { put(localStorage, "cl_first", String(Date.now())); log("visitor_new", info); }
  if (!get(sessionStorage, "cl_sess")) { put(sessionStorage, "cl_sess", String(Date.now())); log("session_start", { ...info, first }); }
}

export default function Tracker() {
  const path = usePathname();

  useEffect(() => { if (!path.startsWith("/admin")) startEvents(path); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Time on each page (only while the tab is visible) and how far down they scrolled.
  useEffect(() => {
    if (path.startsWith("/admin")) return;
    const search = window.location.search;
    const u = new URLSearchParams(search).get("u") ?? "";
    let active = 0, since = document.visibilityState === "visible" ? Date.now() : 0, depth = 0, sent = false;
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      depth = Math.max(depth, max > 0 ? Math.round((100 * el.scrollTop) / max) : 100);
    };
    const vis = () => {
      if (document.visibilityState === "visible") since = Date.now();
      else if (since) { active += Date.now() - since; since = 0; }
    };
    const flush = () => {
      if (sent) return;
      sent = true;
      if (since) { active += Date.now() - since; since = 0; }
      if (active > 1000) log("page_leave", { path, url: u, ms: active, depth: Math.min(100, depth) });
    };
    const hide = () => { if (document.visibilityState === "hidden" && !sent) { vis(); log("page_leave", { path, url: u, ms: active + (since ? Date.now() - since : 0), depth: Math.min(100, depth), partial: true }); } };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", vis);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", vis);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [path]);

  // How long each story preview (headline and summary) is on screen, so we can tell "looked and passed" from "opened".
  useEffect(() => {
    if (path !== "/") return;
    const rows = new Map<Element, { url: string; ms: number; since: number; considered: boolean; inView: boolean }>();
    const sent = new Map<string, number>();
    const emit = (r: { url: string; ms: number }) => {
      if (r.ms < 1000 || (sent.get(r.url) ?? 0) >= r.ms) return;
      sent.set(r.url, r.ms);
      log("preview_dwell", { url: r.url, ms: r.ms });
    };
    const stop = (r: { url: string; ms: number; since: number; considered: boolean; inView: boolean }) => {
      if (r.since) { r.ms += Date.now() - r.since; r.since = 0; }
      emit(r);
    };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const r = rows.get(e.target);
        if (!r) continue;
        r.inView = e.isIntersecting;
        if (e.isIntersecting && document.visibilityState === "visible") { if (!r.since) r.since = Date.now(); } else stop(r);
      }
    }, { threshold: 0.5 });
    const watch = () => {
      document.querySelectorAll("article.row[id^='row-']").forEach((el) => {
        if (rows.has(el)) return;
        rows.set(el, { url: el.id.slice(4), ms: 0, since: 0, considered: false, inView: false });
        io.observe(el);
      });
    };
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    // A story counts as "considered" once its preview has been on screen about 3 seconds.
    const tick = setInterval(() => {
      for (const r of rows.values()) {
        if (r.considered) continue;
        const total = r.ms + (r.since ? Date.now() - r.since : 0);
        if (total >= 3000) { r.considered = true; log("preview_considered", { url: r.url, ms: total }); }
      }
    }, 500);
    const vis = () => { for (const r of rows.values()) { if (document.visibilityState === "hidden") stop(r); else if (r.inView && !r.since) r.since = Date.now(); } };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", vis);
    return () => { clearInterval(tick); mo.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", vis); window.removeEventListener("pagehide", vis); for (const r of rows.values()) stop(r); };
  }, [path]);

  // Clicks that leave the site, and clicks into a full story.
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      let u: URL;
      try { u = new URL(a.href, window.location.href); } catch { return; }
      if (u.origin !== window.location.origin) { log("outbound_click", { host: u.hostname.replace(/^www\./, ""), href: u.href.slice(0, 300), from: window.location.pathname }); return; }
      if (u.pathname === "/story" && u.searchParams.get("u")) log("read_story_click", { url: u.searchParams.get("u"), from: window.location.pathname });
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);

  // Anything that breaks for a visitor.
  useEffect(() => {
    let n = 0;
    const err = (m: string) => { if (n++ < 5) log("client_error", { path: window.location.pathname, message: m.slice(0, 200) }); };
    const a = (e: ErrorEvent) => err(e.message || "error");
    const b = (e: PromiseRejectionEvent) => err(String(e.reason?.message ?? e.reason ?? "rejection"));
    window.addEventListener("error", a); window.addEventListener("unhandledrejection", b);
    return () => { window.removeEventListener("error", a); window.removeEventListener("unhandledrejection", b); };
  }, []);

  return null;
}
