// Approved sources. Only these domains can be fetched. Final list = whatever passes the fetch test.
export type SourceTier = "primary" | "reporting" | "other-side";

export const SOURCES: Record<string, { name: string; tier: SourceTier }> = {
  "about.fb.com": { name: "Meta Newsroom", tier: "primary" },
  "blog.google": { name: "Google Blog", tier: "primary" },
  "apple.com": { name: "Apple Newsroom", tier: "primary" },
  "blogs.microsoft.com": { name: "Microsoft Blog", tier: "primary" },
  "openai.com": { name: "OpenAI", tier: "primary" },
  "anthropic.com": { name: "Anthropic", tier: "primary" },
  "blogs.nvidia.com": { name: "NVIDIA Blog", tier: "primary" },
  "sec.gov": { name: "SEC filings", tier: "primary" },
  "reuters.com": { name: "Reuters", tier: "reporting" },
  "apnews.com": { name: "AP", tier: "reporting" },
  "techcrunch.com": { name: "TechCrunch", tier: "reporting" },
  "theverge.com": { name: "The Verge", tier: "reporting" },
  "arstechnica.com": { name: "Ars Technica", tier: "reporting" },
  "wired.com": { name: "Wired", tier: "reporting" },
  "cnbc.com": { name: "CNBC", tier: "reporting" },
  "edsurge.com": { name: "EdSurge", tier: "reporting" },
  "ftc.gov": { name: "FTC", tier: "other-side" },
  "ec.europa.eu": { name: "European Commission", tier: "other-side" },
  "eff.org": { name: "EFF", tier: "other-side" },
};

export function lookupSource(url: string) {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    host = u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  for (const d of Object.keys(SOURCES)) {
    if (host === d || host.endsWith("." + d)) return { domain: d, ...SOURCES[d] };
  }
  return null;
}
