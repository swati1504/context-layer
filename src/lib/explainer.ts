import { z } from "zod";
import { llmJson } from "./llm";
import { quoteExists } from "./verify";
import { datesOk, supportCheck, type Claim2 } from "./card";
import type { Article } from "./fetchArticle";

const From = z.enum(["primary", "reporting"]);
const Claim = z.object({ text: z.string(), quote: z.string(), from: From });
const Raw = z.object({
  sections: z.array(z.object({ heading: z.string(), claims: z.array(Claim), background: z.string() })),
  faq: z.array(z.object({ question: z.string(), answer: z.array(Claim) })),
});
const claimJ = { type: "object", additionalProperties: false, required: ["text", "quote", "from"], properties: { text: { type: "string" }, quote: { type: "string" }, from: { type: "string", enum: ["primary", "reporting"] } } };
const schema = {
  type: "object", additionalProperties: false, required: ["sections", "faq"],
  properties: {
    sections: { type: "array", items: { type: "object", additionalProperties: false, required: ["heading", "claims", "background"], properties: { heading: { type: "string" }, claims: { type: "array", items: claimJ }, background: { type: "string" } } } },
    faq: { type: "array", items: { type: "object", additionalProperties: false, required: ["question", "answer"], properties: { question: { type: "string" }, answer: { type: "array", items: claimJ } } } },
  },
};

const SYSTEM = `You write a 2-3 minute explainer for a reader with no tech background, from one news article (and the company's own announcement if a [PRIMARY] part is given).
Rules:
- Facts about what happened, who is affected, what changed, dates, numbers and what readers can do come ONLY from the provided text. Each such sentence is one claim with an EXACT verbatim quote (20-200 characters) from the text it comes from. "from" is "primary" or "reporting" according to where the quote is.
- Each claim is ONE sentence a quote fully supports, including timing, scope, certainty and who said it. Attribute company statements ("Backblaze says...").
- Dates: use a date and year only as the quote gives them, tied to the same event. A practice that began on one date and a new policy that takes effect on another are different events. Never infer a year. Say rumors, plans and proposals are rumors, plans and proposals.
- sections: 3-5 sections with plain headings that fit this story, written as questions or short labels (for example "What changed", "Are my files included?", "Who this affects", "What you can do", "What is still unclear"). Put the most useful practical question first. Each section has 1-3 claims in reading order so they flow as a short paragraph. Do not repeat the same fact in two sections.
- Include a section headed "What you can do" ONLY if the text gives a practical step. If it gives none, include that section with an empty claims list (we will say the reporting does not say).
- background: in at most 2 short sentences, explain ONE stable general concept a beginner needs for that section (for example what an IP address is). It must be timeless general knowledge: NO numbers, years, prices, company actions, news facts or claims about this story. Use an empty string when the section needs none. Most sections need none; give background for at most 2 sections.
- faq: 3 questions a reader affected by this story would ask. Answer each with 1-2 claims from the text. If the text does not answer an important practical question (for example "Does this include my files?"), still include the question with an EMPTY answer list. Never answer from outside knowledge.`;

export type Section = { heading: string; claims: Claim2[]; background: string | null };
export type Faq = { question: string; answers: Claim2[]; answered: boolean };
export type Explainer = {
  rev: 1;
  sections: Section[];
  faq: Faq[];
  verification: { total: number; verified: number; dropped: number };
};

const timeless = (b: string) => b.trim() && b.length < 400 && !/\d|\$|%/.test(b);

export async function generateExplainer(a: Article): Promise<Explainer> {
  const text = a.primary
    ? `[PRIMARY: ${a.primary.name}]\n${a.primary.text.slice(0, 9000)}\n\n[REPORTING: ${a.sourceName}]\nTitle: ${a.title}\n${a.text.slice(0, 14000)}`
    : `[REPORTING: ${a.sourceName}]\nTitle: ${a.title}\n${a.text}`;
  const r = await llmJson({ system: SYSTEM, user: text, schemaName: "explainer", schema });
  const raw = Raw.parse(r.json);
  const body = (f: "primary" | "reporting") => (f === "primary" && a.primary ? a.primary.text : a.text);
  const ok = (c: Claim2) => quoteExists(body(c.from), c.quote) && datesOk(c.text, c.quote);

  const all: Claim2[] = [...raw.sections.flatMap((s) => s.claims), ...raw.faq.flatMap((f) => f.answer)];
  const pre = new Set(all.filter(ok));
  const list = [...pre];
  const { bad } = await supportCheck(list.map((c) => ({ t: c.text, q: c.quote })));
  const good = new Set(list.filter((_, i) => !bad.has(i)));

  const sections: Section[] = raw.sections
    .map((s) => ({ heading: s.heading, claims: s.claims.filter((c) => good.has(c)), background: timeless(s.background) ? s.background.trim() : null }))
    .filter((s) => s.claims.length > 0 || /can do/i.test(s.heading));
  const faq: Faq[] = raw.faq.map((f) => {
    const answers = f.answer.filter((c) => good.has(c));
    return { question: f.question, answers, answered: answers.length > 0 };
  });
  if (sections.every((s) => s.claims.length === 0)) throw new Error("no verifiable explainer");
  return { rev: 1, sections, faq, verification: { total: all.length, verified: good.size, dropped: all.length - good.size } };
}
