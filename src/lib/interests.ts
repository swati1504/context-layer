// Shared by the server (feed tagging) and the browser (ranking). Keywords match at the start of a word, so "ban" does not match "bank".
export const INTERESTS: Record<string, string[]> = {
  "AI at work": ["agent", "copilot", "workplace", "enterprise", "productivity", "automation", "employee", "layoff", "jobs", "workflow", "office"],
  "Privacy": ["privacy", "tracking", "surveillance", "consent", "advertis", "data collection", "facial recognition", "personal data"],
  "Apps I use": ["instagram", "tiktok", "youtube", "whatsapp", "iphone", "android", "chatgpt", "gemini", "spotify", "snapchat", "facebook", "reddit", "x.com", "app store", "netflix", "uber", "airbnb"],
  "Big Tech": ["google", "apple", "meta", "amazon", "microsoft", "openai", "nvidia", "anthropic", "tesla", "alphabet", "samsung"],
  "Money and business": ["funding", "valuation", "earnings", "revenue", "acquisition", "acquire", "ipo", "stock market", "shares", "raises", "fintech", "payment", "bank", "crypto", "bitcoin", "stablecoin", "invest", "profit", "merger", "market cap", "wall street"],
  "Chips and hardware": ["chip", "gpu", "hardware", "semiconductor", "satellite", "robot", "processor", "data center", "datacenter", "device", "wearable", "battery", "laptop", "headset"],
  "Kids and school": ["kids", "children", "child", "teen", "student", "school", "education", "teacher", "classroom", "college", "parents", "minors"],
  "Health and medicine": ["health", "medical", "fda", "patient", "drug", "hospital", "doctor", "clinical", "biotech", "medicine", "therapy", "mental health", "healthcare", "genome", "cancer", "vaccine", "pharma", "disease", "nurse", "surgery", "wellness", "peptide"],
  "Science and space": ["science", "scientist", "climate", "nasa", "space", "astronom", "asteroid", "planet", "physics", "species", "ocean", "energy", "fusion", "quantum", "biolog"],
  "Policy and law": ["regulat", "ftc", "court", "law", "lawsuit", "sue", "senate", "congress", "ban", "policy", "copyright", "antitrust", "judge", "legislat", "government", "eu ", "attorney", "fine", "trial"],
  "Creators and media": ["creator", "music", "film", "movie", "streaming", "artist", "publisher", "video game", "gaming", "podcast", "influencer", "hollywood", "news publisher"],
  "Startups": ["startup", "founder", "seed", "series a", "series b", "raises", "y combinator", "venture", "vc "],
  "Security": ["security", "hack", "breach", "vulnerab", "malware", "attack", "scam", "ransomware", "phishing", "leak", "cyber", "exploit"],
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RX: Record<string, RegExp[]> = Object.fromEntries(Object.entries(INTERESTS).map(([k, ws]) => [k, ws.map((w) => new RegExp(`(^|[^a-z0-9])${esc(w.trim())}`, "i"))]));

export function matchCount(interest: string, text: string): number {
  return (RX[interest] ?? []).filter((r) => r.test(text)).length;
}
// Interests a story belongs to. A topic feed (for example a health feed) counts as one match.
export function classify(text: string, hint?: string[]): string[] {
  const out: { k: string; n: number }[] = [];
  for (const k of Object.keys(INTERESTS)) {
    const n = matchCount(k, text) + (hint?.includes(k) ? 1 : 0);
    if (n >= 1) out.push({ k, n });
  }
  return out.sort((a, b) => b.n - a.n).map((x) => x.k);
}
