import { z } from "zod";
import { llmJson } from "./llm";
import { quoteExists } from "./verify";
import type { Article } from "./fetchArticle";

// ---------- schema the model must fill ----------
const From = z.enum(["primary", "reporting"]);
const Claim = z.object({ text: z.string(), quote: z.string(), from: From });
const Raw = z.object({
  headline: z.string(),
  summary: Claim,
  key_points: z.array(Claim),
  how_it_works: z.array(Claim),
  perspectives: z.array(z.object({ who: z.string(), stance: z.string(), quote: z.string(), from: From })),
  jargon: z.array(z.object({ term: z.string(), plain: z.string() })),
  question: z.string(),
  tags: z.array(z.string()),
});

const claimJ = { type: "object", additionalProperties: false, required: ["text", "quote", "from"], properties: { text: { type: "string" }, quote: { type: "string" }, from: { type: "string", enum: ["primary", "reporting"] } } };
const schema = {
  type: "object", additionalProperties: false,
  required: ["headline", "summary", "key_points", "how_it_works", "perspectives", "jargon", "question", "tags"],
  properties: {
    headline: { type: "string" },
    summary: claimJ,
    key_points: { type: "array", items: claimJ },
    how_it_works: { type: "array", items: claimJ },
    perspectives: { type: "array", items: { type: "object", additionalProperties: false, required: ["who", "stance", "quote", "from"], properties: { who: { type: "string" }, stance: { type: "string" }, quote: { type: "string" }, from: { type: "string", enum: ["primary", "reporting"] } } } },
    jargon: { type: "array", items: { type: "object", additionalProperties: false, required: ["term", "plain"], properties: { term: { type: "string" }, plain: { type: "string" } } } },
    question: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
  },
};

const SYSTEM = `You turn a tech news article into a short, plain-English explainer for a reader with no tech background.
Rules:
- Use ONLY facts stated in the provided text. Never add outside knowledge.
- The text may have a [PRIMARY] part (the company's own announcement) and a [REPORTING] part (a news article). Mark each claim's "from" as "primary" or "reporting" according to where its quote comes from. If there is no [PRIMARY] part, use "reporting" for everything.
- Every claim needs a "quote": an EXACT, verbatim passage (20-200 characters) copied from the text it comes from. Never paraphrase the quote.
- A claim must be fully supported by its quote, including timing (started vs. now), scope (some vs. all), certainty (reportedly, may), and who said it. When a company says something, attribute it ("OpenAI says...").
- headline: a plain-English headline of at most 12 words that says what happened. Specific, factual, no hype, no clickbait.
- summary: ONE plain sentence (under 28 words) giving the whole story, with its own quote.
- key_points: 3-4 short claims on what changed, who it affects, and what is still uncertain.
- how_it_works: 2-4 claims explaining the mechanism in everyday words (skip if the text gives no mechanism).
- perspectives: 0-3 DIFFERENT positions the text reports (a company, a regulator, a critic, an expert). "who" is the named person or organization, "stance" is their position in one sentence, with a verbatim quote. Never invent a viewpoint.
- jargon: only terms or product names a NON-TECHNICAL reader would not know. Skip household names (ChatGPT, Google, Amazon, Meta, AI). 0-4 items, each with a one-sentence plain explanation the text supports.
- question: one curious question a beginner would ask about the story, under 14 words (for example "What is a usage meter, and does it change anything for me?").
- tags: 3-6 lowercase tags (companies, topics, who it affects).
- If the text does not support a claim, leave it out.`;

const SupportOut = z.object({ unsupported: z.array(z.number()) });
const supportSchema = { type: "object", additionalProperties: false, required: ["unsupported"], properties: { unsupported: { type: "array", items: { type: "number" } } } };

export type Claim2 = { text: string; quote: string; from: "primary" | "reporting" };
export type Perspective = { who: string; stance: string; quote: string; from: "primary" | "reporting" };
export type VerifiedCard = {
  v: 2;
  headline: string;
  publisher_headline: string;
  summary: Claim2;
  key_points: Claim2[];
  how_it_works: Claim2[];
  perspectives: Perspective[];
  jargon: { term: string; plain: string }[];
  question: string;
  tags: string[];
  read_seconds: number;
  verification: { total: number; verified: number; dropped: number };
  approved: boolean;
  sources: { kind: "primary" | "reporting"; name: string; url: string; approved: boolean }[];
  usage: { model: string; inputTokens: number; outputTokens: number };
};

export async function generateCard(a: Article): Promise<VerifiedCard> {
  const text = a.primary
    ? `[PRIMARY: ${a.primary.name}]\n${a.primary.text.slice(0, 9000)}\n\n[REPORTING: ${a.sourceName}]\nTitle: ${a.title}\n${a.text.slice(0, 14000)}`
    : `[REPORTING: ${a.sourceName}]\nTitle: ${a.title}\n${a.text}`;
  const r = await llmJson({ system: SYSTEM, user: text, schemaName: "context_card", schema });
  let inTok = r.inputTokens, outTok = r.outputTokens;
  const raw = Raw.parse(r.json);

  const body = (from: "primary" | "reporting") => (from === "primary" && a.primary ? a.primary.text : a.text);
  const found = <T extends { quote: string; from: "primary" | "reporting" }>(xs: T[]) => xs.filter((x) => quoteExists(body(x.from), x.quote));

  let summary = raw.summary;
  const summaryOk = quoteExists(body(summary.from), summary.quote);
  let kp = found(raw.key_points);
  let hw = found(raw.how_it_works);
  let ps = found(raw.perspectives);
  const total = 1 + raw.key_points.length + raw.how_it_works.length + raw.perspectives.length;

  // Second check: does each quote actually support its full claim (timing, scope, certainty)?
  const list = [
    ...(summaryOk ? [{ t: summary.text, q: summary.quote }] : []),
    ...kp.map((c) => ({ t: c.text, q: c.quote })),
    ...hw.map((c) => ({ t: c.text, q: c.quote })),
    ...ps.map((p) => ({ t: p.stance, q: p.quote })),
  ];
  let bad = new Set<number>();
  try {
    const s = await llmJson({
      system: "You are a strict fact checker. For each numbered item you get a CLAIM and the QUOTE it cites. Return the numbers of items where the quote does NOT fully support the claim, including its timing, scope, certainty, cause, or who said it. If a claim says more than the quote shows, it is unsupported.",
      user: list.map((x, i) => `${i}. CLAIM: ${x.t}\n   QUOTE: ${x.q}`).join("\n"),
      schemaName: "support_check",
      schema: supportSchema,
    });
    inTok += s.inputTokens; outTok += s.outputTokens;
    bad = new Set(SupportOut.parse(s.json).unsupported);
  } catch {
    // if the second check fails we keep the quote-checked claims
  }
  let i = 0;
  const summaryBad = summaryOk ? bad.has(i++) : true;
  kp = kp.filter(() => !bad.has(i++));
  hw = hw.filter(() => !bad.has(i++));
  ps = ps.filter(() => !bad.has(i++));

  if (summaryBad) {
    if (kp[0]) summary = kp[0]; // fall back to a verified key point
    else throw new Error("no verifiable claims");
  }
  const verified = (summaryBad ? 0 : 1) + kp.length + hw.length + ps.length;
  const words = [summary.text, ...kp.map((c) => c.text), ...hw.map((c) => c.text)].join(" ").split(/\s+/).length;
  const sources: VerifiedCard["sources"] = [];
  if (a.primary) sources.push({ kind: "primary", name: a.primary.name, url: a.primary.url, approved: true });
  sources.push({ kind: "reporting", name: a.sourceName, url: a.url, approved: a.approved });

  return {
    v: 2,
    headline: raw.headline,
    publisher_headline: a.title,
    summary,
    key_points: kp,
    how_it_works: hw,
    perspectives: ps,
    jargon: raw.jargon,
    question: raw.question,
    tags: raw.tags,
    read_seconds: Math.max(20, Math.round((words / 220) * 60 / 10) * 10),
    verification: { total, verified, dropped: Math.max(0, total - verified) },
    approved: a.approved,
    sources,
    usage: { model: r.model, inputTokens: inTok, outputTokens: outTok },
  };
}
