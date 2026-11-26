"use client";
import { useEffect, useState } from "react";

const ADJ = ["Quiet", "Curious", "Patient", "Bright", "Steady", "Careful", "Keen", "Calm", "Sharp", "Plain", "Wry", "Candid"];
const NOUN = ["Reader", "Otter", "Falcon", "Maple", "Comet", "Harbor", "Lantern", "Pebble", "Signal", "Fern", "Orbit", "Badger"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const get = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const put = (k: string, v: string) => { try { localStorage.setItem(k, v); window.dispatchEvent(new Event("cl-handle")); } catch {} };

export function getHandle(): string {
  let h = get("cl_name");
  if (!h) { h = `${pick(ADJ)}${pick(NOUN)}${Math.floor(10 + Math.random() * 90)}`; put("cl_name", h); }
  return h;
}
export const canRename = () => get("cl_renamed") !== "1";
export function rename(v: string): boolean {
  const n = v.replace(/[^\w ]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
  if (n.length < 2 || !canRename()) return false;
  put("cl_name", n); put("cl_renamed", "1");
  return true;
}
export function useHandle() {
  const [h, setH] = useState("");
  useEffect(() => {
    const u = () => setH(getHandle());
    u();
    window.addEventListener("cl-handle", u);
    return () => window.removeEventListener("cl-handle", u);
  }, []);
  return h;
}

export type Mine = { id: string; url: string; title: string; body: string; ts: string };
export const getMine = (): Mine[] => { try { return JSON.parse(get("cl_mine") || "[]"); } catch { return []; } };
export function addMine(m: Mine) { put("cl_mine", JSON.stringify([m, ...getMine().filter((x) => x.id !== m.id)].slice(0, 100))); }
