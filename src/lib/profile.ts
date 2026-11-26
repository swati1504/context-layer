"use client";
import { useEffect, useState } from "react";

export type Profile = { interests: string[]; role: string; industry: string; comfort: "beginner" | "some" | "comfortable" };
const K = "cl_profile";

export function loadProfile(): Profile | null {
  try {
    const s = localStorage.getItem(K);
    if (!s) return null;
    const o = JSON.parse(s) as Partial<Profile>;
    const mig = (o.interests ?? []).flatMap((i) => (i === "Health and science" ? ["Health and medicine", "Science and space"] : [i]));
    return { interests: mig, role: o.role ?? "", industry: o.industry ?? "", comfort: o.comfort ?? "beginner" };
  } catch { return null; }
}
export function saveProfile(p: Profile) {
  try { localStorage.setItem(K, JSON.stringify(p)); } catch {}
  window.dispatchEvent(new Event("cl-profile"));
}
export function useProfile() {
  const [p, setP] = useState<Profile | null>(null);
  useEffect(() => {
    const f = () => setP(loadProfile());
    f();
    window.addEventListener("cl-profile", f);
    return () => window.removeEventListener("cl-profile", f);
  }, []);
  return p;
}
export const openProfile = () => window.dispatchEvent(new Event("cl-open-profile"));

export const ROLES = ["Student", "Marketing", "Product or design", "Sales", "Finance", "Healthcare", "Education", "Legal or policy", "Engineer", "Other"];
export const INDUSTRIES = ["Consumer and retail", "Advertising and media", "Finance and banking", "Healthcare", "Education", "Government and policy", "Software and tech", "Manufacturing", "Nonprofit", "Other"];
export const COMFORT = [
  { v: "beginner", label: "New to tech", hint: "Explain everything" },
  { v: "some", label: "Some familiarity", hint: "Explain the hard parts" },
  { v: "comfortable", label: "Comfortable", hint: "Keep it brief" },
] as const;

export { INTERESTS } from "./interests";
import { matchCount } from "./interests";
const ROLE_TO_INTEREST: Record<string, string> = { Marketing: "Creators and media", Finance: "Money and business", Healthcare: "Health and medicine", Education: "Kids and school", "Legal or policy": "Policy and law", Engineer: "AI at work", Student: "Kids and school" };

// ---- on-device reading history (tags of cards the person opened) ----
const H = "cl_history";
export function readHistory(): string[] { try { return JSON.parse(localStorage.getItem(H) ?? "[]") as string[]; } catch { return []; } }
export function addHistory(tags: string[]) {
  try { localStorage.setItem(H, JSON.stringify([...new Set([...tags.map((t) => t.toLowerCase()), ...readHistory()])].slice(0, 60))); } catch {}
}

// Explainable ranking: every boost has a reason a person can read.
// `topics` is what the server tagged the story with (matches on its headline and summary).
export function rankReason(p: Profile | null, topics: string[], history: string[], text: string): { score: number; reason?: string; match: boolean } {
  let score = 0, reason: string | undefined, match = false;
  if (p) {
    const mine = [...p.interests, ...(ROLE_TO_INTEREST[p.role] && p.interests.length === 0 ? [ROLE_TO_INTEREST[p.role]] : [])];
    for (const i of mine) {
      if (!topics.includes(i)) continue;
      const n = Math.max(1, matchCount(i, text));
      match = true;
      if (n > score) { score = n; reason = `Because you picked ${i}`; }
    }
  }
  const t = ` ${text.toLowerCase()} `;
  const h = history.find((tag) => tag.length > 3 && t.includes(tag));
  if (h && !match) { score = 0.5; reason = `Because you read about ${h}`; }
  return { score, reason, match };
}
