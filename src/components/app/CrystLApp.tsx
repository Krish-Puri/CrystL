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
import { GroundingExercise } from "@/components/reflect/GroundingExercise";
import LoadingState from "@/components/ui/LoadingState";
import ErrorState from "@/components/ui/ErrorState";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { useAppState, useAppDispatch, useConversation } from "@/context/AppContext";
import { useSession } from "@/hooks/useSession";
import { trackEvent } from "@/lib/analytics";
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
  const [groundingExercise, setGroundingExercise] = useState<string | undefined>();

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
      trackEvent("recording_started");
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
    // If user edited the transcript before sending
    const wasEdited = transcript !== ""; // simplified check
    trackEvent("transcript_edited", { via_voice: true });
    trackEvent("recording_completed");
    await sendMessage(transcript);
  }

  // ── Mood selection ─────────────────────────────────────────────────────────
  // Mood sets the mood, then ConversationModePicker appears.
  // Mode selection is what opens the recording panel.
  function handleMoodSelect(mood: Mood) {
    setMood(mood);
    trackEvent("mood_selected", { mood });
    // ConversationModePicker is shown via the derived `showModePicker` state
    // (mood is set, mode is still null → mode picker appears)
  }

  // ── Mode selection ─────────────────────────────────────────────────────────

  function handleModeSelect(mode: ConversationMode) {
    setMode(mode);
    trackEvent("conversation_started", { mode });
    // Open recording panel immediately so user can speak
    dispatch({ type: "OPEN_RECORDING" });
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
    const res = await fetch(`/api/reflections/${state.sessionId}/draft`, {
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
                  {!state.mood ? (
                    <SessionGreeting
                      variant={isFirst ? "first" : "returning"}
                      lastTheme={state.lastMemory}
                      onMoodSelect={handleMoodSelect}
                      onStartFresh={() => dispatch({ type: "START_SESSION", session_id: state.sessionId ?? "", is_first: true })}
                      onPickUp={() => { dispatch({ type: "SET_MODE", mode: state.mode ?? "default" }); }}
                    />
                  ) : (
                    <ConversationModePicker onSelect={handleModeSelect} />
                  )}
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
                    <LoadingState message="I'm thinking…" />
                  )}
                  {state.isGeneratingReflection && (
                    <div className="flex-1 flex items-center justify-center">
                      <LoadingState message="Generating reflection…" />
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
                <ErrorState
                  message={state.error}
                  onRetry={() => dispatch({ type: "SET_ERROR", error: null })}
                />
              )}
            </AnimatePresence>

            {/* Bottom mic area */}
            {!showModePicker && hasMessages && !state.hasEnded && (
              <div className="flex flex-col items-center gap-2 pt-3 pb-1">
                <MicOrb onClick={handleMicClick} size={72} isListening={isListening} />
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
              trackEvent("grounding_opened", { exercise_id: groundingExercise });
            }}
          />
        )}
      </div>

      {/* Grounding exercise modal */}
      <AnimatePresence>
        {showGrounding && (
          <GroundingExercise onClose={() => setShowGrounding(false)} initialExercise={groundingExercise} />
        )}
      </AnimatePresence>

      {/* Reflect drawer */}
      <ReflectDrawer
        open={reflectOpen}
        onClose={() => setReflectOpen(false)}
        reflections={reflections}
        themeTrends={themeTrends}
        onGroundingOpen={(exerciseId) => {
          setGroundingExercise(exerciseId);
          setShowGrounding(true);
          trackEvent("grounding_opened", { exercise_id: exerciseId });
        }}
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

