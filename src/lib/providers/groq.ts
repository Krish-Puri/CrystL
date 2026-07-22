// Groq LLM provider — OpenAI-compatible chat completions API.
// Model: openai/gpt-oss-20b (Groq's JSON-capable model).

import type { LLMCallResult, LLMConfig, LLMProvider } from "../llm";

const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const BASE_URL = "https://api.groq.com/openai/v1";

export class GroqProvider implements LLMProvider {
  async call(prompt: string, config: LLMConfig): Promise<LLMCallResult> {
    const start = Date.now();

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 512,
      }),
    });

    const latency_ms = Date.now() - start;

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Groq API error: ${res.status} ${res.statusText} — ${text}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";

    return {
      text,
      latency_ms,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    };
  }
}
