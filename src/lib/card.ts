import { z } from "zod";
import { llmJson } from "./llm";
import { quoteExists } from "./verify";
import type { Article } from "./fetchArticle";

// ---------- schema the model must fill ----------
const From = z.enum(["primary", "reporting"]);
const Claim = z.object({ text: z.string(), quote: z.string(), from: From });
const Raw = z.object({
  headline: z.string(),
  summary_parts: z.array(Claim),
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
  required: ["headline", "summary_parts", "key_points", "how_it_works", "perspectives", "jargon", "question", "tags"],
  properties: {
    headline: { type: "string" },
    summary_parts: { type: "array", items: claimJ },
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
- If the text describes a rumor, leak, report, dummy unit, plan or prediction, the claim must say so ("reportedly", "a leaked dummy suggests", "plans to"). Never state a rumor as settled fact, in the headline and summary too.
- A claim must be fully supported by its quote, including timing (started vs. now), scope (some vs. all), certainty (reportedly, may), and who said it. When a company says something, attribute it ("OpenAI says...").
- headline: a plain-English headline of at most 12 words that says what happened. Specific, factual, no hype, no clickbait.
- summary_parts: 3-4 plain sentences that together read as one short news paragraph (60-90 words) telling the whole story: what happened, who is involved, what changes, what is still unclear. The FIRST sentence must state the main event itself (what happened and who did it) before any detail. EACH sentence is its own claim with its own exact verbatim quote. Keep each sentence to one fact its quote fully supports. Distinguish something newly starting from something a new policy or report only discloses as already happening.
- key_points: 3-4 crisp one-line claims that ADD details the summary does not already say (who it affects, dates, limits, what is uncertain). Never repeat the summary.
- how_it_works: 2-4 claims explaining the mechanism in everyday words (skip if the text gives no mechanism).
- perspectives: 0-3 collective views of what people are saying about the story, grouped by who is speaking (for example "The company", "Critics and some users", "Regulators", "Analysts"). "who" is that group label (use a named organization only when one named source speaks for the group), "stance" is what that group says in one sentence, with a verbatim quote. Never invent a viewpoint.
- jargon: only terms or product names a NON-TECHNICAL reader would not know. Skip household names (ChatGPT, Google, Amazon, Meta, AI). 0-4 items, each with a one-sentence plain explanation the text supports.
- question: one curious question a beginner would ask about the story, under 14 words (for example "What is a usage meter, and does it change anything for me?").
- tags: 3-6 lowercase tags (companies, topics, who it affects).
- If the text does not support a claim, leave it out.`;

const SupportOut = z.object({ unsupported: z.array(z.number()) });
const supportSchema = { type: "object", additionalProperties: false, required: ["unsupported"], properties: { unsupported: { type: "array", items: { type: "number" } } } };

export type Claim2 = { text: string; quote: string; from: "primary" | "reporting" };
export type Perspective = { who: string; stance: string; quote: string; from: "primary" | "reporting" };
export type Summary2 = { text: string; quote: string; quotes: string[]; from: "primary" | "reporting" };
export type VerifiedCard = {
  v: 2;
  rev: 3;
  headline: string;
  publisher_headline: string;
  summary: Summary2;
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

  let parts = found(raw.summary_parts);
  let kp = found(raw.key_points);
  let hw = found(raw.how_it_works);
  let ps = found(raw.perspectives);
  const total = raw.summary_parts.length + raw.key_points.length + raw.how_it_works.length + raw.perspectives.length;

  // Second check: does each quote actually support its full claim (timing, scope, certainty)?
  // The headline is checked too, against the summary quotes, not just the bullets.
  const hasSummary = parts.length > 0;
  const list = [
    ...parts.map((c) => ({ t: c.text, q: c.quote })),
    ...(hasSummary ? [{ t: raw.headline, q: parts.map((c) => c.quote).join(" ... ") }] : []),
    ...kp.map((c) => ({ t: c.text, q: c.quote })),
    ...hw.map((c) => ({ t: c.text, q: c.quote })),
    ...ps.map((p) => ({ t: p.stance, q: p.quote })),
  ];
  let bad = new Set<number>();
  try {
    const s = await llmJson({
      system: "You are a strict fact checker. For each numbered item you get a CLAIM and the QUOTE(S) it cites. Return the numbers of items where the quotes do NOT fully support the claim, including its timing, scope, certainty, cause, or who said it. Treat 'a company starts doing X' as unsupported when the quotes only show a policy or report disclosing that it already does X. If a claim says more than the quotes show, it is unsupported.",
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
  parts = parts.filter(() => !bad.has(i++));
  const headlineBad = hasSummary ? bad.has(i++) : true;
  kp = kp.filter(() => !bad.has(i++));
  hw = hw.filter(() => !bad.has(i++));
  ps = ps.filter(() => !bad.has(i++));

  if (parts.length === 0) {
    if (!kp[0]) throw new Error("no verifiable claims");
    parts = [kp[0]]; // fall back to a verified key point
    kp = kp.slice(1);
  }
  const summary: Summary2 = { text: parts.map((c) => c.text).join(" "), quote: parts[0].quote, quotes: parts.map((c) => c.quote), from: parts[0].from };
  const headline = headlineBad ? a.title : raw.headline;
  const verified = parts.length + kp.length + hw.length + ps.length;
  const words = [summary.text, ...kp.map((c) => c.text), ...hw.map((c) => c.text)].join(" ").split(/\s+/).length;
  const sources: VerifiedCard["sources"] = [];
  if (a.primary) sources.push({ kind: "primary", name: a.primary.name, url: a.primary.url, approved: true });
  sources.push({ kind: "reporting", name: a.sourceName, url: a.url, approved: a.approved });

  return {
    v: 2,
    rev: 3,
    headline,
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
