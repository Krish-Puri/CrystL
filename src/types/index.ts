// CrystL shared types

export type Mood = "calm" | "okay" | "low" | "sad" | "overwhelmed";

export type Intent =
  | "vent"
  | "reflection"
  | "advice"
  | "grounding"
  | "checkin"
  | "context"
  | "pause";

export type ConversationPhase =
  | "start"
  | "checkin"
  | "explore"
  | "clarify"
  | "support"
  | "reflection"
  | "close";

export type ConversationMode = "vent" | "reflection" | "advice" | "default";

export type SafetyLevel = 0 | 1 | 2;

export type AppState = "chat" | "recording" | "safety";

export type ThemeTrend = "improving" | "stable" | "worsening" | "new";

export interface Session {
  id: string;
  user_id: string;
  created_at: string;
  ended_at: string | null;
  mood_at_start: Mood | null;
  memory_summary: string | null;
  theme: string | null;
  is_active: boolean;
}

export interface ConversationState {
  session_id: string;
  current_mood: Mood | null;
  current_intent: Intent | null;
  conversation_phase: ConversationPhase;
  current_theme: string | null;
  safety_level: SafetyLevel;
  last_reflection_saved: boolean;
  message_count: number;
  grounding_recommended: boolean;
  is_paused: boolean;
  mode: ConversationMode;
}

export interface Message {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  intent: Intent | null;
  created_at: string;
}

export interface Reflection {
  id: string;
  user_id: string;
  session_id: string;
  content: string;
  theme: string;
  mood: Mood | null;
  next_step: string | null;
  created_at: string;
}

export interface ThemeTrendEntry {
  id: string;
  user_id: string;
  theme: string;
  conversation_count: number;
  trend: ThemeTrend;
  last_mood: Mood | null;
  updated_at: string;
}

export interface OrchestratorResponse {
  role: "assistant";
  content: string;
  phase: ConversationPhase;
  is_pause_acknowledged?: boolean;
  // Internal — used by orchestrator logic, not shown directly in UI
  intent?: Intent;
  safety_level?: SafetyLevel;
}

export interface SafetyEvaluation {
  level: SafetyLevel;
  reason?: string;
}

// ── ConversationDecision — from orchestrator ────────────────────────────────

export interface ConversationDecision {
  ai: {
    response: string;
    intent: Intent;
    suggested_phase: ConversationPhase;
  };
  ui: {
    show_reflection: boolean;
    open_safety: boolean;
    open_grounding?: boolean;
  };
  persistence: {
    update_theme: string | null;
    update_mood: Mood | null;
    end_session: boolean;
  };
  safety_level: SafetyLevel;
}

// ── Reflection Draft ───────────────────────────────────────────────────────

export interface ReflectionDraft {
  id?: string;
  content: string;
  theme_slug: string;
  mood: Mood;
  next_step: string | null;
}

// ── App Reducer Actions ─────────────────────────────────────────────────────

export type AppAction =
  | { type: "START_SESSION"; session_id: string; is_first: boolean }
  | { type: "ADD_MESSAGE"; message: Message }
  | { type: "SET_PHASE"; phase: ConversationPhase }
  | { type: "SET_MOOD"; mood: Mood }
  | { type: "SET_MODE"; mode: ConversationMode }
  | { type: "OPEN_RECORDING" }
  | { type: "CLOSE_RECORDING" }
  | { type: "SHOW_SAFETY" }
  | { type: "SHOW_REFLECTION"; draft: ReflectionDraft }
  | { type: "SHOW_GROUNDING" }
  | { type: "OPEN_REFLECT" }
  | { type: "CLOSE_REFLECT" }
  | { type: "CLEAR_REFLECTION_DRAFT" }
  | { type: "END_SESSION" }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null };
