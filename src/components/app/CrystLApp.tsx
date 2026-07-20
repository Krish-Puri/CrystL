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
import { SafetyOverlay } from "@/components/safety/SafetyOverlay";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import type {
  AppState,
  ConversationMode,
  Message,
  Mood,
  Reflection,
  ThemeTrendEntry,
} from "@/types";

// Demo messages for the visual prototype
const DEMO_MESSAGES: Message[] = [
  {
    id: "1",
    session_id: "demo",
    role: "user",
    content:
      "I don't think I can handle tomorrow's presentation. I feel like I'm failing at everything.",
    intent: "vent",
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    session_id: "demo",
    role: "assistant",
    content:
      "I hear you.\n\nIt sounds like tomorrow feels bigger than the presentation itself.\n\nOne small thing you could try: write just the opening line you'd say tomorrow.",
    intent: "vent",
    created_at: new Date().toISOString(),
  },
];

export function CrystLApp() {
  // App state
  const [appState, setAppState] = useState<AppState>("chat");
  const [sessionVariant, setSessionVariant] = useState<"first" | "returning">("first");
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [mode, setMode] = useState<ConversationMode | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showModePicker, setShowModePicker] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reflect drawer
  const [reflectOpen, setReflectOpen] = useState(false);

  // Demo data
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

  // Start recording
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

  // Send from recording panel
  function handleSend() {
    if (!transcript.trim()) return;
    setIsRecording(false);
    stopListening();
    if (timerRef.current) clearInterval(timerRef.current);
    setAppState("chat");
    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      session_id: "demo",
      role: "user",
      content: transcript,
      intent: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setTranscript("");
    // Simulate AI response after delay
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        session_id: "demo",
        role: "assistant",
        content:
          "I hear you.\n\nIt sounds like tomorrow feels bigger than the presentation itself.\n\nOne small thing you could try: write just the opening line you'd say tomorrow.",
        intent: "vent",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 1200);
  }

  // Mood selection
  function handleMoodSelect(mood: Mood) {
    setSelectedMood(mood);
    // Proceed to mode picker after mood
    setTimeout(() => setShowModePicker(true), 600);
  }

  // Mode selection
  function handleModeSelect(selectedMode: ConversationMode) {
    setMode(selectedMode);
    setShowModePicker(false);
  }

  // Switching app states (demo)
  function switchState(state: AppState) {
    setAppState(state);
  }

  const showChat = appState === "chat";
  const showRecording = appState === "recording";
  const showSafety = appState === "safety";

  return (
    <>
      {/* Main app shell */}
      <div
        className="relative flex flex-col"
        style={{ height: "620px", backgroundColor: "var(--surface-2)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-5 pb-2">
          <div className="flex gap-1.5">
            <button
              className={`session-btn text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                sessionVariant === "first"
                  ? "active bg-surface-1 border-border-strong"
                  : "bg-transparent border-border hover:border-border-strong"
              }`}
              onClick={() => setSessionVariant("first")}
            >
              First session
            </button>
            <button
              className={`session-btn text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                sessionVariant === "returning"
                  ? "active bg-surface-1 border-border-strong"
                  : "bg-transparent border-border hover:border-border-strong"
              }`}
              onClick={() => setSessionVariant("returning")}
            >
              Returning
            </button>
          </div>

          {/* Reflect trigger */}
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

        {/* Chat panel */}
        {showChat && (
          <div className="flex-1 overflow-hidden flex flex-col px-8 pt-3 pb-2">
            <AnimatePresence mode="wait">
              {showModePicker ? (
                <ConversationModePicker onSelect={handleModeSelect} />
              ) : messages.length === 0 ? (
                <motion.div
                  key="greeting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-1.5"
                >
                  <SessionGreeting
                    variant={sessionVariant}
                    lastTheme="preparing for a presentation"
                    onMoodSelect={handleMoodSelect}
                    onStartFresh={() => setSessionVariant("first")}
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
                  {messages.map((msg) =>
                    msg.role === "user" ? (
                      <UserMessage key={msg.id} content={msg.content} />
                    ) : (
                      <AIMessage
                        key={msg.id}
                        content={msg.content}
                        showReplay={true}
                      />
                    )
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom mic area */}
            {!showModePicker && messages.length > 0 && (
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
              setAppState("chat");
            }}
          />
        )}

        {/* Safety panel */}
        {showSafety && (
          <SafetyOverlay
            onContinueTalking={() => setAppState("chat")}
            onGrounding={() => setAppState("chat")}
          />
        )}
      </div>

      {/* Reflect drawer */}
      <ReflectDrawer
        open={reflectOpen}
        onClose={() => setReflectOpen(false)}
        reflections={reflections}
        themeTrends={themeTrends}
      />

      {/* State switcher (demo/debug) */}
      <DemoStateSwitcher current={appState} onSwitch={switchState} />
    </>
  );
}

// Demo-only state switcher for previewing all states
function DemoStateSwitcher({
  current,
  onSwitch,
}: {
  current: AppState;
  onSwitch: (s: AppState) => void;
}) {
  return (
    <div className="flex items-center gap-2 mt-4 flex-wrap">
      <span className="text-xs text-muted-foreground">Preview state:</span>
      {(["chat", "recording", "safety"] as AppState[]).map((s) => (
        <button
          key={s}
          onClick={() => onSwitch(s)}
          className={`
            state-btn text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors
            ${current === s ? "active" : "bg-transparent border-border hover:border-border-strong"}
          `}
        >
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </button>
      ))}
    </div>
  );
}
