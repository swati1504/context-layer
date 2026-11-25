"use client";
import { useEffect, useState } from "react";

export type Profile = { role: string; industry: string; comfort: "beginner" | "some" | "comfortable" };
const K = "cl_profile";

export function loadProfile(): Profile | null {
  try { const s = localStorage.getItem(K); return s ? (JSON.parse(s) as Profile) : null; } catch { return null; }
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

// Feed ranking: simple keyword overlap between the story and the person's role and industry.
const KEYS: Record<string, string[]> = {
  "Advertising and media": ["ad ", "ads", "advertis", "campaign", "brand", "creator", "social", "instagram", "tiktok", "meta", "youtube", "streaming", "media"],
  Marketing: ["ad ", "ads", "advertis", "campaign", "brand", "creator", "social", "instagram", "tiktok", "meta", "search"],
  "Consumer and retail": ["amazon", "shop", "retail", "commerce", "walmart", "toy", "consumer", "phone", "earbuds", "price"],
  "Finance and banking": ["bank", "payment", "stripe", "crypto", "fintech", "stock", "earnings", "sec ", "funding", "valuation"],
  Finance: ["bank", "payment", "stripe", "crypto", "stock", "earnings", "funding", "valuation"],
  Healthcare: ["health", "medical", "fda", "patient", "drug", "hospital", "clinical"],
  Education: ["student", "school", "teacher", "college", "learning", "kids", "children", "education"],
  Student: ["student", "intern", "job", "career", "college", "free", "chatgpt", "school"],
  "Government and policy": ["regulat", "ftc", "fcc", "law", "court", "privacy", "attorney", "senate", "ban", "policy"],
  "Legal or policy": ["regulat", "ftc", "fcc", "law", "court", "privacy", "attorney", "copyright", "lawsuit", "ban"],
  "Software and tech": ["developer", "api", "open source", "model", "chip", "gpu", "cloud", "code", "agent"],
  Engineer: ["developer", "api", "open source", "model", "chip", "gpu", "cloud", "code", "agent"],
  "Product or design": ["design", "app", "ux", "product", "launch", "interface", "agent"],
  Sales: ["sales", "crm", "customers", "enterprise", "pricing", "agent"],
};
export function rankReason(p: Profile | null, text: string): { score: number; reason?: string } {
  if (!p) return { score: 0 };
  const t = ` ${text.toLowerCase()} `;
  let best = 0, reason: string | undefined;
  for (const [label, words] of [[p.industry, KEYS[p.industry]], [p.role, KEYS[p.role]]] as const) {
    if (!words) continue;
    const n = words.filter((w) => t.includes(w)).length;
    if (n > best) { best = n; reason = label === p.industry ? `Because you work in ${p.industry.toLowerCase()}` : `Because you are in ${p.role.toLowerCase()}`; }
  }
  return { score: best, reason };
}
