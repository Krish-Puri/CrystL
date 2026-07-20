// CrystL Gemini API client
// All parsing uses Zod safeParse — never raw JSON.parse

import { z } from "zod";
import {
  ConversationDecisionSchema,
  SafetyEvaluationSchema,
  ReflectionDraftSchema,
} from "./schemas";
import type { ConversationDecision } from "./schemas";
import { getPersona } from "./prompts/personality.v1";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

// ── JSON extraction ──────────────────────────────────────────────────────────

/**
 * Extract valid JSON from a string that may be wrapped in markdown,
 * prefixed with an apology, or truncated mid-string.
 */
function extractJSON(text: string): string {
  const trimmed = text.trim();

  // Case 1: starts with `{` — find the matching closing brace
  if (trimmed.startsWith("{")) {
    let depth = 0;
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === "{") depth++;
      if (trimmed[i] === "}") depth--;
      if (depth === 0) return trimmed.slice(0, i + 1);
    }
  }

  // Case 2: markdown code block
  const jsonMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) return jsonMatch[1].trim();

  // Case 3: "Here's the JSON:" prefix or similar
  const colonIdx = trimmed.indexOf(":");
  const braceIdx = trimmed.indexOf("{");
  if (braceIdx !== -1 && (colonIdx === -1 || braceIdx < colonIdx)) {
    return trimmed.slice(braceIdx);
  }

  return "{}";
}

// ── API call helper ─────────────────────────────────────────────────────────

interface GeminiCallResult {
  text: string;
  latency_ms: number;
  inputTokens?: number;
  outputTokens?: number;
}

async function callGemini(
  prompt: string,
  temperature: number,
  maxOutputTokens: number
): Promise<GeminiCallResult> {
  const start = Date.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens },
      }),
    }
  );
  const latency_ms = Date.now() - start;

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  return { text, latency_ms };
}

// ── Safety classification ───────────────────────────────────────────────────

const SAFETY_PROMPT = `You are a safety classifier for CrystL, an emotional support companion.
Evaluate the user's message and return a JSON object.

User message: """{message}"""

Safety levels:
- 0 = safe: normal conversational content
- 1 = concerning: user expresses distress, sadness, hopelessness, but no acute crisis
- 2 = high-risk: user mentions self-harm, suicide, wanting to die, or acute crisis

Respond with ONLY valid JSON:
{
  "level": 0|1|2,
  "reason": "brief explanation"
}`;

export async function classifySafety(
  message: string
): Promise<{ level: 0 | 1 | 2; reason: string; latency_ms: number; model: string; operation: "safety" }> {
  const prompt = SAFETY_PROMPT.replace("{message}", message);
  const { text, latency_ms } = await callGemini(prompt, 0.1, 64);
  const extracted = extractJSON(text);

  const result = SafetyEvaluationSchema.safeParse(JSON.parse(extracted));
  if (result.success) return { level: result.data.level as 0 | 1 | 2, reason: result.data.reason ?? "", latency_ms, model: GEMINI_MODEL, operation: "safety" };

  // Fallback on parse failure — be conservative
  console.error("[classifySafety] parse failed, defaulting to level 0:", result.error?.message);
  return { level: 0, reason: "parse error", latency_ms, model: GEMINI_MODEL, operation: "safety" };
}

// ── Prompt helpers ──────────────────────────────────────────────────────────

function modeInstruction(mode: string): string {
  switch (mode) {
    case "vent":
      return "VENT MODE: The user wants to be heard. Acknowledge what they shared specifically. Do NOT offer advice or solutions.";
    case "reflection":
      return "REFLECTION MODE: The user wants to think something through. Gently surface one observation. Ask one short clarifying question if useful. Do not problem-solve.";
    case "advice":
      return "ADVICE MODE: The user wants a suggestion. Offer exactly one small, concrete micro-action they could try in the next few minutes.";
    default:
      return "DEFAULT MODE: Let the user's intent guide you. Respond naturally and warmly.";
  }
}

// ── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Call the orchestrator with up to `maxRetries` on parse failure.
 * Uses Zod safeParse — never raw JSON.parse.
 */
async function runOrchestratorWithRetry(
  prompt: string,
  maxRetries: number = 2
): Promise<ConversationDecision> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { text } = await callGemini(prompt, 0.7, 512);
    const extracted = extractJSON(text);

    const result = ConversationDecisionSchema.safeParse(JSON.parse(extracted));
    if (result.success) return result.data;

    console.error(
      `[runOrchestrator] parse attempt ${attempt + 1} failed:`,
      result.error?.message
    );
  }

  // Ultimate fallback — return a safe default, never throw
  console.error("[runOrchestrator] all retries exhausted, returning safe default");
  return {
    ai: {
      response: "I'm still here. Take your time.",
      intent: "context",
      suggested_phase: "explore",
    },
    ui: { show_reflection: false, open_safety: false },
    persistence: { update_theme: null, update_mood: null, end_session: false },
    safety_level: 0,
  };
}

export async function runOrchestrator(params: {
  message: string;
  mode: string;
  phase: string;
  episodicMemory: string | null;
  semanticMemory: string | null;
  personalityVersion: number;
}): Promise<ConversationDecision> {
  const { message, mode, phase, episodicMemory, semanticMemory, personalityVersion } = params;

  const systemPrompt = getPersona(personalityVersion);
  const prompt = systemPrompt
    .replace("{mode_instruction}", modeInstruction(mode))
    .replace("{phase}", phase)
    .replace(
      "{episodic_memory}",
      episodicMemory
        ? `Last session: ${episodicMemory}`
        : "(No prior sessions)"
    )
    .replace(
      "{semantic_memory}",
      semanticMemory
        ? `Theme history:\n${semanticMemory}`
        : "(No prior theme history)"
    )
    .replace("{message}", message);

  return runOrchestratorWithRetry(prompt);
}

// ── Reflection generation ───────────────────────────────────────────────────

const REFLECTION_PROMPT = `The following is a conversation between a user and CrystL.

CONVERSATION:
{conversation}

Generate a reflection card for this conversation. Return ONLY valid JSON:
{
  "content": "2-3 sentences summarizing the emotional theme and what was discussed",
  "theme_slug": "a short slug for the theme (e.g. 'presentation-anxiety', 'career-growth', 'general')",
  "next_step": "one small, concrete micro-action the user could try (or null if not applicable)"
}`;

export async function generateReflection(
  conversation: string
): Promise<{ content: string; theme_slug: string; next_step: string | null; latency_ms: number; model: string; operation: "reflection" }> {
  const prompt = REFLECTION_PROMPT.replace("{conversation}", conversation);
  const { text, latency_ms } = await callGemini(prompt, 0.5, 256);
  const extracted = extractJSON(text);

  const result = ReflectionDraftSchema.safeParse(JSON.parse(extracted));
  if (result.success) return { ...result.data, latency_ms, model: GEMINI_MODEL, operation: "reflection" as const };

  console.error("[generateReflection] parse failed:", result.error?.message);
  return { content: "A meaningful conversation took place.", theme_slug: "general", next_step: null, latency_ms, model: GEMINI_MODEL, operation: "reflection" as const };
}

// ── Episodic summary generation ─────────────────────────────────────────────

const EPISODIC_SUMMARY_PROMPT = `Summarize this conversation in 1-2 sentences.
Focus on the emotional theme and the user's current situation.
Do not include advice. Format as a single paragraph.

Conversation:
{conversation}`;

export async function generateEpisodicSummary(
  conversation: string
): Promise<{ summary: string; latency_ms: number; model: string; operation: "summary" }> {
  const prompt = EPISODIC_SUMMARY_PROMPT.replace("{conversation}", conversation);
  const { text, latency_ms } = await callGemini(prompt, 0.3, 128);
  return {
    summary: text.trim() || "A meaningful conversation took place.",
    latency_ms,
    model: GEMINI_MODEL,
    operation: "summary",
  };
}

// ── AI Usage logging helper ─────────────────────────────────────────────────

export interface AIUsageLog {
  user_id?: string;
  session_id?: string;
  model: string;
  operation: "orchestrator" | "safety" | "reflection" | "summary";
  input_tokens?: number;
  output_tokens?: number;
  latency_ms: number;
  success: boolean;
  error_message?: string;
}
