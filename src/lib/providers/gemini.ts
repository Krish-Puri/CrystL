// Gemini LLM provider — direct REST API (kept for reference/comparison).

import type { LLMCallResult, LLMConfig, LLMProvider } from "../llm";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

function extractJSON(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    let depth = 0;
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === "{") depth++;
      if (trimmed[i] === "}") depth--;
      if (depth === 0) return trimmed.slice(0, i + 1);
    }
  }
  const jsonMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) return jsonMatch[1].trim();
  const braceIdx = trimmed.indexOf("{");
  if (braceIdx !== -1) return trimmed.slice(braceIdx);
  return "{}";
}

export class GeminiProvider implements LLMProvider {
  async call(prompt: string, config: LLMConfig): Promise<LLMCallResult> {
    const start = Date.now();

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: config.temperature ?? 0.7,
            maxOutputTokens: config.maxTokens ?? 512,
          },
        }),
      }
    );

    const latency_ms = Date.now() - start;

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return {
      text: extractJSON(rawText),
      latency_ms,
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
    };
  }
}
