// CrystL Canonical Contracts
// Single source of truth for cross-layer Zod schemas and normalization helpers.
// All API routes, hooks, and providers should import from here — not from schemas.ts.

import { z } from "zod";

// ── Mood normalization ────────────────────────────────────────────────────────

const MoodRaw = z.union([
  z.enum(["calm", "okay", "low", "sad", "overwhelmed"]),
  z.string(),
  z.null(),
]);
export type MoodRaw = z.infer<typeof MoodRaw>;

export function normalizeMood(v: MoodRaw): "calm" | "okay" | "low" | "sad" | "overwhelmed" {
  if (v === "null" || v === null || v === undefined) return "okay";
  return MoodRaw.parse(v) as "calm" | "okay" | "low" | "sad" | "overwhelmed";
}

// ── Phase normalization ───────────────────────────────────────────────────────

export const PhaseEnum = z.enum([
  "checkin",
  "start",
  "explore",
  "clarify",
  "support",
  "reflection",
  "close",
]);
export type Phase = z.infer<typeof PhaseEnum>;

export function normalizePhase(v: unknown): Phase {
  const result = PhaseEnum.safeParse(v);
  return result.success ? result.data : "explore";
}

// ── Memory / Episodic response ────────────────────────────────────────────────

export const MemoryResponseSchema = z.object({
  memory_summary: z.string().nullable(),
  theme: z.string().nullable().optional(),
  mood_at_start: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});

export const EpisodicMemorySchema = z.object({
  episodic: MemoryResponseSchema.nullable(),
  // Canonical "memory" key — preferred over episodic
  memory: MemoryResponseSchema.nullable().optional(),
});

/** Returns memory_summary from the canonical key (memory preferred, episodic fallback). */
export function extractMemorySummary(data: unknown): string | null {
  const parsed = EpisodicMemorySchema.safeParse(data);
  if (!parsed.success) return null;
  return (
    parsed.data.memory?.memory_summary ??
    parsed.data.episodic?.memory_summary ??
    null
  );
}

// ── Reflection draft ──────────────────────────────────────────────────────────

export const ReflectionDraftContract = z.object({
  content: z.string(),
  theme_slug: z.string(),
  mood: z.string(), // normalized — never null from caller
  next_step: z.preprocess(
    (v) => (v === "null" || v === null ? null : v),
    z.string().nullable()
  ),
});

export function normalizeReflectionDraft(
  raw: unknown
): z.infer<typeof ReflectionDraftContract> {
  const parsed = ReflectionDraftContract.safeParse(raw);
  if (!parsed.success) {
    return {
      content: "A meaningful conversation took place.",
      theme_slug: "general",
      mood: "okay",
      next_step: null,
    };
  }
  return {
    ...parsed.data,
    mood: normalizeMood(parsed.data.mood as MoodRaw),
  };
}
