// CrystL Zod schemas — validated with safeParse, never raw JSON.parse

import { z } from "zod";

// ── Shared enums ────────────────────────────────────────────────────────────

export const IntentEnum = z.enum([
  "vent",
  "reflection",
  "advice",
  "grounding",
  "checkin",
  "context",
  "pause",
]);

export const PhaseEnum = z.enum([
  "checkin",
  "explore",
  "clarify",
  "support",
  "reflection",
  "close",
]);

export const MoodEnum = z.enum(["calm", "okay", "low", "sad", "overwhelmed"]);

export const SafetyLevelEnum = z.number().min(0).max(2);

// ── ConversationDecision — the core orchestrator output ─────────────────────

export const ConversationDecisionSchema = z.object({
  ai: z.object({
    response: z.string(),
    intent: IntentEnum,
    suggested_phase: PhaseEnum,
  }),
  ui: z.object({
    show_reflection: z.boolean(),
    open_safety: z.boolean(),
    open_grounding: z.boolean().optional(),
  }),
  persistence: z.object({
    update_theme: z.string().nullable(),
    update_mood: MoodEnum.nullable(),
    end_session: z.boolean(),
  }),
  safety_level: SafetyLevelEnum,
});

export type ConversationDecision = z.infer<typeof ConversationDecisionSchema>;

// ── Reflection Draft ───────────────────────────────────────────────────────

export const ReflectionDraftSchema = z.object({
  content: z.string(),
  theme_slug: z.string(),
  mood: MoodEnum,
  next_step: z.string().nullable(),
});

export type ReflectionDraft = z.infer<typeof ReflectionDraftSchema>;

// ── Safety Evaluation ───────────────────────────────────────────────────────

export const SafetyEvaluationSchema = z.object({
  level: SafetyLevelEnum,
  reason: z.string().optional(),
});

export type SafetyEvaluation = z.infer<typeof SafetyEvaluationSchema>;
