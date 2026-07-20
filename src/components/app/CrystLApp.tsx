"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SessionGreeting } from "@/components/chat/SessionGreeting";
import { MoodPicker } from "@/components/chat/MoodPicker";
import { AIMessage } from "@/components/chat/AIMessage";
import { UserMessage } from "@/components/chat/UserMessage";
import { MicOrb } from "@/components/voice/MicOrb";
import { RecordingPanel } from "@/components/voice/RecordingPanel";
import { ConversationModePicker } from "@/components/chat/ConversationModePicker";
import { ReflectDrawer } from "@/components/reflect/ReflectDrawer";
import { ReflectionDraftSheet } from "@/components/reflect/ReflectionDraftSheet";
import { SafetyOverlay } from "@/components/safety/SafetyOverlay";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { useAppState, useAppDispatch, useConversation } from "@/context/AppContext";
import { useSession } from "@/hooks/useSession";
import type { Mood, ConversationMode, Reflection, ThemeTrendEntry } from "@/types";

export function CrystLApp() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { setMood, setMode, isFirst } = useSession();
  const { sendMessage, endSession } = useConversation();

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Grounding exercise
  const [showGrounding, setShowGrounding] = useState(false);

  // Reflect drawer (for journal access)
  const [reflectOpen, setReflectOpen] = useState(false);

  // Demo reflections/trends (placeholder — loaded from API in full version)
  const [reflections] = useState<Reflection[]>([]);
  const [themeTrends] = useState<ThemeTrendEntry[]>([]);

  // Speech-to-text
  const { isListening, startListening, stopListening, isSupported } =
    useSpeechToText({
      onResult: (text) => setTranscript(text),
      onEnd: () => {
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      },
    });

  // ── Recording ─────────────────────────────────────────────────────────────

  function handleMicClick() {
    if (isRecording) {
      stopListening();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      setTranscript("");
      setElapsedTime(0);
      setIsRecording(true);
      startListening();
      timerRef.current = setInterval(() => {
        setElapsedTime((t) => t + 1);
      }, 1000);
    }
  }

  // ── Send from recording panel ──────────────────────────────────────────────

  async function handleSend() {
    if (!transcript.trim()) return;
    setIsRecording(false);
    stopListening();
    if (timerRef.current) clearInterval(timerRef.current);
    dispatch({ type: "CLOSE_RECORDING" });
    setTranscript("");
    await sendMessage(transcript);
  }

  // ── Mood selection ─────────────────────────────────────────────────────────

  function handleMoodSelect(mood: Mood) {
    setMood(mood);
    setTimeout(() => dispatch({ type: "OPEN_RECORDING" }), 300);
  }

  // ── Mode selection ─────────────────────────────────────────────────────────

  function handleModeSelect(mode: ConversationMode) {
    setMode(mode);
    dispatch({ type: "CLOSE_RECORDING" });
  }

  // ── End session ─────────────────────────────────────────────────────────────

  function handleEndSession() {
    endSession();
  }

  // ── Reflection draft handlers ───────────────────────────────────────────────

  const handleReflectionSave = useCallback(
    async (content: string) => {
      if (!state.reflectionDraft || !state.sessionId) return;
      const res = await fetch("/api/reflections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: state.sessionId,
          content,
          theme_slug: state.reflectionDraft.theme_slug,
          mood: state.reflectionDraft.mood,
          next_step: state.reflectionDraft.next_step,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      dispatch({ type: "CLEAR_REFLECTION_DRAFT" });
    },
    [state.reflectionDraft, state.sessionId, dispatch]
  );

  const handleReflectionRegenerate = useCallback(async () => {
    if (!state.reflectionDraft || !state.sessionId) return;
    const res = await fetch(`/api/reflections/${state.sessionId}/draft/regenerate`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Regenerate failed");
    const data = await res.json();
    dispatch({
      type: "UPDATE_REFLECTION_DRAFT",
      draft: {
        id: data.draft.id,
        content: data.draft.content,
        theme_slug: data.draft.theme_slug,
        mood: data.draft.mood as Mood,
        next_step: data.draft.next_step,
      },
    });
  }, [state.reflectionDraft, state.sessionId, dispatch]);

  const handleReflectionDiscard = useCallback(async () => {
    if (!state.sessionId) return;
    const res = await fetch(`/api/reflections/${state.sessionId}/draft`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Discard failed");
    dispatch({ type: "CLEAR_REFLECTION_DRAFT" });
  }, [state.sessionId, dispatch]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const showChat = state.appState === "chat";
  const showRecording = state.appState === "recording";
  const showSafety = state.appState === "safety";
  const showModePicker = state.mode === null;
  const hasMessages = state.messages.length > 0;
  const isLoading = state.isLoading;

  return (
    <>
      <div
        className="relative flex flex-col"
        style={{ height: "620px", backgroundColor: "var(--surface-2)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-5 pb-2">
          {/* Session info */}
          <div className="flex items-center gap-2">
            {state.sessionId && (
              <span className="text-xs text-muted-foreground">
                {isFirst ? "First session" : "Returning"}
              </span>
            )}
          </div>

          {/* Right side: End session + Reflect */}
          <div className="flex items-center gap-2">
            {hasMessages && !state.hasEnded && (
              <button
                onClick={handleEndSession}
                className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-border-strong transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
              >
                End session
              </button>
            )}
            <button
              onClick={() => setReflectOpen(true)}
              aria-label="Reflect tools"
              className="
                w-8 h-8 rounded-full flex items-center justify-center
                hover:bg-surface-1 transition-colors cursor-pointer
              "
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chat panel */}
        {showChat && (
          <div className="flex-1 overflow-hidden flex flex-col px-8 pt-3 pb-2">
            <AnimatePresence mode="wait">
              {showModePicker ? (
                <motion.div
                  key="greeting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-1.5"
                >
                  <SessionGreeting
                    variant={isFirst ? "first" : "returning"}
                    lastTheme={null}
                    onMoodSelect={handleMoodSelect}
                    onStartFresh={() => dispatch({ type: "START_SESSION", session_id: state.sessionId ?? "", is_first: true })}
                    onPickUp={() => {}}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="conversation"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 overflow-y-auto flex flex-col"
                >
                  {isLoading && (
                    <div className="flex items-center gap-2 px-4 py-3">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}
                  {state.messages.map((msg) =>
                    msg.role === "user" ? (
                      <UserMessage key={msg.id} content={msg.content} />
                    ) : (
                      <AIMessage key={msg.id} content={msg.content} showReplay={true} />
                    )
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error banner */}
            <AnimatePresence>
              {state.error && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mx-auto mb-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500"
                >
                  {state.error}
                  <button
                    onClick={() => dispatch({ type: "SET_ERROR", error: null })}
                    className="ml-2 underline cursor-pointer"
                  >
                    Dismiss
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom mic area */}
            {!showModePicker && hasMessages && !state.hasEnded && (
              <div className="flex flex-col items-center gap-2 pt-3 pb-1">
                <MicOrb onClick={handleMicClick} size={72} />
                <p className="text-xs text-muted-foreground">Hold to speak</p>
              </div>
            )}
          </div>
        )}

        {/* Recording panel */}
        {showRecording && (
          <RecordingPanel
            transcript={transcript}
            isListening={isListening}
            elapsedTime={elapsedTime}
            onTranscriptChange={setTranscript}
            onSend={handleSend}
            onCancel={() => {
              setIsRecording(false);
              stopListening();
              if (timerRef.current) clearInterval(timerRef.current);
              dispatch({ type: "CLOSE_RECORDING" });
            }}
          />
        )}

        {/* Safety panel */}
        {showSafety && (
          <SafetyOverlay
            onContinueTalking={() => dispatch({ type: "CLOSE_RECORDING" })}
            onGrounding={() => {
              dispatch({ type: "CLOSE_RECORDING" });
              setShowGrounding(true);
            }}
          />
        )}
      </div>

      {/* Grounding exercise modal */}
      <AnimatePresence>
        {showGrounding && (
          <GroundingModal onClose={() => setShowGrounding(false)} />
        )}
      </AnimatePresence>

      {/* Reflect drawer */}
      <ReflectDrawer
        open={reflectOpen}
        onClose={() => setReflectOpen(false)}
        reflections={reflections}
        themeTrends={themeTrends}
        onGroundingOpen={() => setShowGrounding(true)}
      />

      {/* Reflection draft sheet — shown after session ends */}
      {state.reflectionDraft && (
        <ReflectionDraftSheet
          draft={state.reflectionDraft}
          onSave={handleReflectionSave}
          onRegenerate={handleReflectionRegenerate}
          onDiscard={handleReflectionDiscard}
        />
      )}
    </>
  );
}

// ── Grounding Modal (simple inline component) ───────────────────────────────

import { type ReactNode } from "react";

function GroundingModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-sm rounded-2xl bg-surface-1 p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-foreground">Grounding</h2>

        {/* 5-4-3-2-1 exercise */}
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">Notice 5 things around you</p>
          <div className="grid grid-cols-5 gap-2">
            {["5", "4", "3", "2", "1"].map((n) => (
              <button
                key={n}
                className="h-10 rounded-lg border border-border bg-surface-2 text-sm font-medium text-foreground hover:border-border-strong transition-colors cursor-pointer"
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Look around and name 5 things you can see. Then 4 you can touch. Keep going.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
        >
          Done
        </button>
      </motion.div>
    </motion.div>
  );
}
