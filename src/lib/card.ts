import { z } from "zod";
import { llmJson } from "./llm";
import { quoteExists } from "./verify";
import type { Article } from "./fetchArticle";

const Claim = z.object({ text: z.string(), quote: z.string() });
const Card = z.object({
  headline: z.string(),
  whats_new: z.array(Claim),
  how_it_works: z.array(Claim),
  jargon: z.array(z.object({ term: z.string(), plain: z.string() })),
  tags: z.array(z.string()),
});

const claimSchema = {
  type: "object", additionalProperties: false, required: ["text", "quote"],
  properties: { text: { type: "string" }, quote: { type: "string" } },
};
const schema = {
  type: "object", additionalProperties: false,
  required: ["headline", "whats_new", "how_it_works", "jargon", "tags"],
  properties: {
    headline: { type: "string" },
    whats_new: { type: "array", items: claimSchema },
    how_it_works: { type: "array", items: claimSchema },
    jargon: { type: "array", items: { type: "object", additionalProperties: false, required: ["term", "plain"], properties: { term: { type: "string" }, plain: { type: "string" } } } },
    tags: { type: "array", items: { type: "string" } },
  },
};

const SYSTEM = `You write "context cards" for non-technical readers about a tech news article.
Rules:
- Use ONLY facts stated in the article. Never add outside knowledge.
- Every claim needs a "quote": an EXACT, verbatim passage (20-200 chars) copied from the article that supports it. Do not paraphrase the quote.
- "text" is the plain-language claim (one sentence, no jargon, 8th-grade reading level).
- whats_new: 2-4 claims. how_it_works: 2-4 claims explaining the mechanism in plain words.
- jargon: terms or product names a beginner may not know, each with a one-sentence plain explanation (use only what the article supports).
- tags: 3-6 lowercase tags (company, topic, who it affects).
- If the article does not support a claim, leave it out.`;

export type VerifiedCard = {
  headline: string;
  whats_new: { text: string; quote: string }[];
  how_it_works: { text: string; quote: string }[];
  jargon: { term: string; plain: string }[];
  tags: string[];
  verification: { total: number; verified: number; dropped: number };
  source: { name: string; tier: string; url: string };
  usage: { model: string; inputTokens: number; outputTokens: number };
};

export async function generateCard(a: Article): Promise<VerifiedCard> {
  const r = await llmJson({
    system: SYSTEM,
    user: `Title: ${a.title}\n\nArticle:\n${a.text}`,
    schemaName: "context_card",
    schema,
  });
  const card = Card.parse(r.json);
  const keep = (cs: z.infer<typeof Claim>[]) => cs.filter((c) => quoteExists(a.text, c.quote));
  const wn = keep(card.whats_new);
  const hw = keep(card.how_it_works);
  const total = card.whats_new.length + card.how_it_works.length;
  const verified = wn.length + hw.length;
  return {
    headline: card.headline,
    whats_new: wn,
    how_it_works: hw,
    jargon: card.jargon,
    tags: card.tags,
    verification: { total, verified, dropped: total - verified },
    source: { name: a.sourceName, tier: a.tier, url: a.url },
    usage: { model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens },
  };
}
