"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react";
import type {
  AppState,
  ConversationMode,
  ConversationPhase,
  Message,
  Mood,
  ReflectionDraft,
  AppAction,
} from "@/types";
import { trackEvent } from "@/lib/analytics";

// ── State ────────────────────────────────────────────────────────────────────

interface AppStore {
  sessionId: string | null;
  isFirst: boolean;
  phase: ConversationPhase;
  mood: Mood | null;
  mode: ConversationMode | null;
  messages: Message[];
  appState: AppState;
  isLoading: boolean;
  isGeneratingReflection: boolean; // waiting for summarize API
  error: string | null;
  reflectOpen: boolean;
  hasEnded: boolean; // session has been closed, showing reflection draft
  reflectionDraft: ReflectionDraft | null;
  lastMemory: string | null;
  rateLimitedUntil: number | null; // Unix ms; while set, UI shows cooldown countdown
}

// Initial state
const initialState: AppStore = {
  sessionId: null,
  isFirst: false,
  phase: "checkin",
  mood: null,
  mode: null,
  messages: [],
  appState: "chat",
  isLoading: false,
  isGeneratingReflection: false,
  error: null,
  reflectOpen: false,
  hasEnded: false,
  reflectionDraft: null,
  lastMemory: null,
  rateLimitedUntil: null,
};

// ── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: AppStore, action: AppAction): AppStore {
  switch (action.type) {
    case "START_SESSION":
      return {
        ...state,
        sessionId: action.session_id,
        isFirst: action.is_first,
        phase: "checkin",
        messages: [],
        appState: "chat",
        isLoading: false,
        error: null,
        reflectOpen: false,
        hasEnded: false,
      };

    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.message] };

    case "SET_PHASE":
      return { ...state, phase: action.phase };

    case "SET_MOOD":
      return { ...state, mood: action.mood };

    case "SET_MODE":
      return { ...state, mode: action.mode, appState: "chat" };

    case "OPEN_RECORDING":
      return { ...state, appState: "recording" };

    case "CLOSE_RECORDING":
      return { ...state, appState: "chat" };

    case "SHOW_SAFETY":
      return { ...state, appState: "safety" };

    case "SHOW_REFLECTION":
      return { ...state, reflectOpen: true, hasEnded: true, reflectionDraft: action.draft };

    case "SHOW_GROUNDING":
      return { ...state, appState: "chat" };

    case "CLEAR_REFLECTION_DRAFT":
      return { ...state, reflectionDraft: null, reflectOpen: false, hasEnded: false };

    case "UPDATE_REFLECTION_DRAFT":
      return { ...state, reflectionDraft: action.draft };

    case "OPEN_REFLECT":
      return { ...state, reflectOpen: true };

    case "CLOSE_REFLECT":
      return { ...state, reflectOpen: false };

    case "END_SESSION":
      return { ...state, hasEnded: true };

    case "SET_LOADING":
      return { ...state, isLoading: action.loading };

    case "SET_ERROR":
      return { ...state, error: action.error };

    case "SET_LAST_MEMORY":
      return { ...state, lastMemory: action.memory };

    case "SET_GENERATING_REFLECTION":
      return { ...state, isGeneratingReflection: action.generating };

    case "SET_RATE_LIMITED":
      return { ...state, rateLimitedUntil: action.until, error: null };

    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppStore;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState(): AppStore {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx.state;
}

export function useAppDispatch(): React.Dispatch<AppAction> {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppDispatch must be used within AppProvider");
  return ctx.dispatch;
}

// ── Derived helpers ──────────────────────────────────────────────────────────

export function useConversation() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const sendMessage = useCallback(
    async (transcript: string, retryCount = 0) => {
      if (!state.sessionId) return;
      dispatch({ type: "SET_LOADING", loading: true });

      try {
        const res = await fetch("/api/orchestrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: state.sessionId,
            transcript,
            is_pause: false,
          }),
        });

        // Rate-limited — keep spinner, show countdown, then retry (max 2 retries)
        if (res.status === 429 && retryCount < 2) {
          const backoffMs = (retryCount + 1) * 5000; // 5s then 10s
          const until = Date.now() + backoffMs;
          dispatch({ type: "SET_RATE_LIMITED", until });
          await new Promise((r) => setTimeout(r, backoffMs));
          dispatch({ type: "SET_RATE_LIMITED", until: null });
          // keep isLoading=true while retrying
          return sendMessage(transcript, retryCount + 1);
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message ?? "Orchestrator failed");
        }

        const data = await res.json();

        // Add user message
        const userMsg: Message = {
          id: Date.now().toString(),
          session_id: state.sessionId,
          role: "user",
          content: transcript,
          intent: null,
          created_at: new Date().toISOString(),
        };
        dispatch({ type: "ADD_MESSAGE", message: userMsg });

        // Add AI message
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          session_id: state.sessionId,
          role: "assistant",
          content: data.content,
          intent: null,
          created_at: new Date().toISOString(),
        };
        dispatch({ type: "ADD_MESSAGE", message: aiMsg });

        // Track event
        trackEvent("message_sent", { via_voice: false, transcript_edited: false });

        // Drive UI from ConversationDecision
        if (data.decision?.open_safety) {
          dispatch({ type: "SHOW_SAFETY" });
        }
        if (data.decision?.show_reflection) {
          dispatch({ type: "SHOW_REFLECTION", draft: data.decision.show_reflection });
        }
        if (data.decision?.open_grounding) {
          dispatch({ type: "SHOW_GROUNDING" });
        }
        if (data.phase) {
          dispatch({ type: "SET_PHASE", phase: data.phase });
        }
        if (data.persistence?.update_mood) {
          dispatch({ type: "SET_MOOD", mood: data.persistence.update_mood });
        }
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          error: err instanceof Error ? err.message : "Something went wrong",
        });
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    },
    [state.sessionId, dispatch]
  );

  const endSession = useCallback(async () => {
    if (!state.sessionId) return;
    dispatch({ type: "SET_GENERATING_REFLECTION", generating: true });

    try {
      // Generate reflection draft
      const res = await fetch("/api/memory/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: state.sessionId }),
      });

      if (!res.ok) throw new Error("I couldn't finish that reflection. Want to try again?");
      const data = await res.json();

      dispatch({ type: "END_SESSION" });
      dispatch({
        type: "SHOW_REFLECTION",
        draft: {
          id: data.draft?.id,
          content: data.draft?.content ?? "",
          theme_slug: data.draft?.theme_slug ?? "general",
          mood: (data.draft?.mood as Mood) ?? state.mood ?? "okay",
          next_step: data.draft?.next_step ?? null,
        },
      });
      // Track after successful reflection draft
      trackEvent("reflection_draft_created", { theme: data.draft?.theme_slug ?? "general" });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Failed to end session",
      });
    } finally {
      dispatch({ type: "SET_GENERATING_REFLECTION", generating: false });
    }
  }, [state.sessionId, state.mood, dispatch]);

  return { sendMessage, endSession };
}
