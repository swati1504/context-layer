// Provider-agnostic structured-JSON call. Switch with LLM_PROVIDER (openai | anthropic).
import OpenAI from "openai";

export type LlmResult = { json: unknown; inputTokens: number; outputTokens: number; model: string };

export async function llmJson(opts: { system: string; user: string; schemaName: string; schema: object }): Promise<LlmResult> {
  const provider = process.env.LLM_PROVIDER ?? "openai";
  if (provider === "openai") {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
    const r = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: opts.schemaName, strict: true, schema: opts.schema as Record<string, unknown> },
      },
    });
    return {
      json: JSON.parse(r.choices[0].message.content ?? "{}"),
      inputTokens: r.usage?.prompt_tokens ?? 0,
      outputTokens: r.usage?.completion_tokens ?? 0,
      model,
    };
  }
  throw new Error(`LLM_PROVIDER "${provider}" not wired yet`);
}
