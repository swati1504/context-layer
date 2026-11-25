"use client";
import { useEffect, useState } from "react";

export type Profile = { interests: string[]; role: string; industry: string; comfort: "beginner" | "some" | "comfortable" };
const K = "cl_profile";

export function loadProfile(): Profile | null {
  try {
    const s = localStorage.getItem(K);
    if (!s) return null;
    const o = JSON.parse(s) as Partial<Profile>;
    return { interests: o.interests ?? [], role: o.role ?? "", industry: o.industry ?? "", comfort: o.comfort ?? "beginner" };
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

// Interests are what the feed ranks on. Each maps to words that show up in headlines.
export const INTERESTS: Record<string, string[]> = {
  "AI at work": ["agent", "copilot", "chatgpt", "workplace", "enterprise", "productivity", "automation", "jobs"],
  "Privacy": ["privacy", "tracking", "surveillance", "consent", "advertis"],
  "Apps I use": ["instagram", "tiktok", "youtube", "whatsapp", "iphone", "android", "chatgpt", "gemini", "spotify"],
  "Big Tech": ["google", "apple", "meta", "amazon", "microsoft", "openai", "nvidia", "anthropic"],
  "Money and business": ["funding", "valuation", "earnings", "revenue", "acquisition", "ipo", "stock", "raises", "billion"],
  "Chips and hardware": ["chip", "gpu", "nvidia", "hardware", "semiconductor", "satellite", "robot"],
  "Kids and school": ["kids", "children", "teen", "student", "school", "education", "teacher"],
  "Health and science": ["health", "medical", "fda", "patient", "drug", "science", "climate"],
  "Policy and law": ["regulat", "ftc", "court", "law", "lawsuit", "senate", "ban", "policy", "copyright", "antitrust"],
  "Creators and media": ["creator", "music", "film", "streaming", "artist", "publisher"],
  "Startups": ["startup", "founder", "seed", "series a", "raises", "seed round"],
  "Security": ["security", "hack", "breach", "vulnerab", "malware", "attack", "scam"],
};
const ROLE_TO_INTEREST: Record<string, string> = { Marketing: "Creators and media", Finance: "Money and business", Healthcare: "Health and science", Education: "Kids and school", "Legal or policy": "Policy and law", Engineer: "AI at work", Student: "Kids and school" };

// ---- on-device reading history (tags of cards the person opened) ----
const H = "cl_history";
export function readHistory(): string[] { try { return JSON.parse(localStorage.getItem(H) ?? "[]") as string[]; } catch { return []; } }
export function addHistory(tags: string[]) {
  try { localStorage.setItem(H, JSON.stringify([...new Set([...tags.map((t) => t.toLowerCase()), ...readHistory()])].slice(0, 60))); } catch {}
}

// Explainable ranking: every boost has a reason a person can read.
export function rankReason(p: Profile | null, text: string, history: string[]): { score: number; reason?: string } {
  const t = ` ${text.toLowerCase()} `;
  let score = 0, reason: string | undefined;
  if (p) {
    const mine = [...p.interests, ...(ROLE_TO_INTEREST[p.role] && p.interests.length === 0 ? [ROLE_TO_INTEREST[p.role]] : [])];
    for (const i of mine) {
      const n = (INTERESTS[i] ?? []).filter((w) => t.includes(w)).length;
      if (n > score) { score = n; reason = `Because you picked ${i}`; }
    }
  }
  const h = history.find((tag) => tag.length > 3 && t.includes(tag));
  if (h && score < 3) { score = Math.max(score, 1) + 0.5; reason = reason && score > 1.5 ? reason : `Because you read about ${h}`; }
  return { score, reason };
}
