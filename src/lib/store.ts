"use client";
import { useEffect, useState } from "react";
import type { Card } from "@/components/ContextCard";

const get = <T,>(k: string, d: T): T => { try { const s = localStorage.getItem(k); return s ? (JSON.parse(s) as T) : d; } catch { return d; } };
const set = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ---- identity + study mode ----
export function pid(): string {
  let id = get<string>("cl_pid", "");
  if (!id) { id = "u_" + Math.random().toString(36).slice(2, 10); set("cl_pid", id); }
  return id;
}
export function isStudy(): boolean {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("study") === "1") { sessionStorage.setItem("cl_study", "1"); const p = q.get("p"); if (p) set("cl_pid", "s_" + p); }
    return sessionStorage.getItem("cl_study") === "1";
  } catch { return false; }
}
export function log(event: string, props: Record<string, unknown> = {}) {
  try {
    fetch("/api/log", { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ pid: pid(), event, props: { ...props, study: isStudy() } }) }).catch(() => {});
  } catch {}
}

// ---- favorites ----
export type Fav = { url: string; title: string; source: string; savedAt: number; card: Card };
export const getFavs = () => get<Fav[]>("cl_favs", []);
export function removeFav(url: string) { set("cl_favs", getFavs().filter((x) => x.url !== url)); window.dispatchEvent(new Event("cl-favs")); }
export function restoreFav(f: Fav) { set("cl_favs", [f, ...getFavs().filter((x) => x.url !== f.url)]); window.dispatchEvent(new Event("cl-favs")); }
export function toggleFav(f: Omit<Fav, "savedAt">): boolean {
  const all = getFavs();
  const has = all.some((x) => x.url === f.url);
  set("cl_favs", has ? all.filter((x) => x.url !== f.url) : [{ ...f, savedAt: Date.now() }, ...all]);
  window.dispatchEvent(new Event("cl-favs"));
  return !has;
}
export function useFavs() {
  const [f, setF] = useState<Fav[]>([]);
  useEffect(() => {
    const u = () => setF(getFavs());
    u();
    window.addEventListener("cl-favs", u);
    return () => window.removeEventListener("cl-favs", u);
  }, []);
  return f;
}

// ---- free plan usage: 5 pasted links a month (feed stories and shared stories are never counted) ----
export const FREE_LIMIT = 5;
const mk = () => "cl_used_" + new Date().toISOString().slice(0, 7);
export const usedCards = () => get<string[]>(mk(), []);
export function markUsed(url: string) { const u = usedCards(); if (!u.includes(url)) set(mk(), [...u, url]); }
export const atLimit = (url: string) => !usedCards().includes(url) && usedCards().length >= FREE_LIMIT;

// ---- reported claims ----
export const getReported = () => get<string[]>("cl_reported", []);
export function markReported(k: string) { set("cl_reported", [...getReported(), k]); }

// ---- sharing: stories have their own page ----
export const storyLink = (url: string) => `${window.location.origin}/story?u=${encodeURIComponent(url)}`;
export async function copyShare(url: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(storyLink(url)); log("share", { url }); return true; } catch { return false; }
}
