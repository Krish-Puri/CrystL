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
} from "@/types";

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
  error: string | null;
  reflectOpen: boolean;
  hasEnded: boolean; // session has been closed, showing reflection draft
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
  error: null,
  reflectOpen: false,
  hasEnded: false,
};

// ── Actions ──────────────────────────────────────────────────────────────────

type AppAction =
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
  | { type: "END_SESSION" }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null };

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
      return { ...state, reflectOpen: true, hasEnded: true };

    case "SHOW_GROUNDING":
      return { ...state, appState: "chat" };

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
    async (transcript: string) => {
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

        if (!res.ok) throw new Error("Orchestrator failed");

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
    dispatch({ type: "SET_LOADING", loading: true });

    try {
      // Generate reflection draft
      const res = await fetch("/api/memory/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: state.sessionId }),
      });

      if (!res.ok) throw new Error("Summarize failed");
      const data = await res.json();

      dispatch({ type: "END_SESSION" });
      dispatch({
        type: "SHOW_REFLECTION",
        draft: {
          content: data.reflection?.content ?? "",
          theme_slug: data.reflection?.theme_slug ?? "general",
          mood: state.mood ?? "okay",
          next_step: data.reflection?.next_step ?? null,
        },
      });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Failed to end session",
      });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, [state.sessionId, state.mood, dispatch]);

  return { sendMessage, endSession };
}
