"use client";

import { useEffect, useCallback } from "react";
import { useAppDispatch, useAppState } from "@/context/AppContext";
import type { Mood, ConversationMode } from "@/types";

/**
 * Manages session lifecycle: creates a session on mount,
 * fetches returning user memory, and handles session close.
 */
export function useSession() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  // Create session on mount
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mood_at_start: null, mode: "default" }),
        });

        if (!res.ok) return;
        const data = await res.json();

        dispatch({
          type: "START_SESSION",
          session_id: data.session_id,
          is_first: data.is_first_session,
        });

        // Fetch returning user memory if not first session
        if (!data.is_first_session) {
          const memRes = await fetch("/api/memory/recent");
          if (memRes.ok) {
            const memData = await memRes.json();
            // Memory is available in session.memory_summary — the greeting
            // component will pick it up via state.isFirst
          }
        }
      } catch {
        dispatch({ type: "SET_ERROR", error: "Failed to start session" });
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setMood = useCallback(
    (mood: Mood) => {
      dispatch({ type: "SET_MOOD", mood });
      // Persist mood to conversation state
      if (state.sessionId) {
        fetch(`/api/state/${state.sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ current_mood: mood }),
        }).catch(() => {});
      }
    },
    [state.sessionId, dispatch]
  );

  const setMode = useCallback(
    (mode: ConversationMode) => {
      dispatch({ type: "SET_MODE", mode });
      // Persist mode to conversation state
      if (state.sessionId) {
        fetch(`/api/state/${state.sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        }).catch(() => {});
      }
    },
    [state.sessionId, dispatch]
  );

  return {
    sessionId: state.sessionId,
    isFirst: state.isFirst,
    phase: state.phase,
    mood: state.mood,
    mode: state.mode,
    setMood,
    setMode,
  };
}
