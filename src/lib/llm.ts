// LLM Provider abstraction
// All LLM calls go through this interface — swap the implementation by changing LLM_PROVIDER.

export interface LLMCallResult {
  text: string;
  latency_ms: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface LLMConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
}

// Default models per provider
export const DEFAULT_MODELS: Record<LLMProviderType, string> = {
  groq: process.env.GROQ_MODEL ?? "openai/gpt-oss-20b",
  gemini: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
};

export interface LLMProvider {
  call(prompt: string, config: LLMConfig): Promise<LLMCallResult>;
}

export type LLMProviderType = "groq" | "gemini";

export function createLLMProvider(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER ?? "groq") as LLMProviderType;
  switch (provider) {
    case "groq":
      return createGroqProvider();
    case "gemini":
    default:
      return createGeminiProvider();
  }
}

// Lazy imports so the other provider's dependencies are only loaded if used
function createGroqProvider(): LLMProvider {
  const { GroqProvider } = require("./providers/groq");
  return new GroqProvider();
}

function createGeminiProvider(): LLMProvider {
  const { GeminiProvider } = require("./providers/gemini");
  return new GeminiProvider();
}
