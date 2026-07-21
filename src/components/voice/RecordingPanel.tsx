"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useSpeechToText } from "@/hooks/useSpeechToText";

interface RecordingPanelProps {
  /** Called when user clicks Send — only the button triggers this. */
  onSend: (text: string) => void;
  /** Called on every keystroke so the parent can track transcript changes (optional). */
  onTranscriptChange?: (text: string) => void;
  onCancel: () => void;
  panelDivRef: React.MutableRefObject<HTMLDivElement | null>;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function RecordingPanel({ onSend, onTranscriptChange, onCancel, panelDivRef }: RecordingPanelProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // onInput fires on every keystroke — push text up to parent but do NOT send.
  const handleInput = useCallback(() => {
    const text = divRef.current?.textContent ?? "";
    onTranscriptChange?.(text);
  }, [onTranscriptChange]);

  // Sync internal divRef → parent's panelDivRef
  useEffect(() => {
    panelDivRef.current = divRef.current;
  }, [panelDivRef]);

  // Speech-to-text — accumulation happens in hook, display in our div
  const { isListening, startListening, stopListening, isSupported } =
    useSpeechToText({
      onResult: () => {
        // Voice text is accumulated by the hook; we read it from the div
        // on send so the DOM is always the source of truth for transcript.
      },
      onEnd: () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      },
    });

  // Auto-start listening when panel mounts
  useEffect(() => {
    if (!isSupported) return;
    startListening();
    timerRef.current = setInterval(() => {
      setElapsedTime((t) => t + 1);
    }, 1000);
    return () => {
      stopListening();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSend() {
    const text = divRef.current?.textContent?.trim() ?? "";
    if (!text) return;
    stopListening();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    onCancel(); // close panel
    onSend(text);
    if (divRef.current) divRef.current.textContent = "";
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center h-full gap-7 px-10 py-16"
    >
      {/* Pulsing mic */}
      <div className="relative flex items-center justify-center w-28 h-28">
        {/* Pulse ring — shown when actively listening */}
        {isListening && (
          <div
            className="absolute inset-0 rounded-full pulse-ring"
            style={{ border: "1.5px solid var(--border-accent)" }}
          />
        )}
        {/* Inner circle */}
        <div
          className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--fill-accent)" }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--on-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
          </svg>
        </div>
      </div>

      {/* Status — shows listening only when actively listening */}
      <p className="text-sm text-muted-foreground">
        {isListening ? "Listening · " : ""}
        {formatTime(elapsedTime)}
      </p>

      {/* Editable transcript */}
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        className="
          w-full max-w-md min-h-[72px]
          font-voice text-xl leading-relaxed text-center
          outline-none py-1 px-2 rounded
          hover:bg-surface-2 focus:bg-surface-2
          transition-colors cursor-text
        "
        style={{ fontFamily: "var(--font-voice)" }}
      />

      <p className="text-xs text-muted-foreground -mt-5">
        {!isSupported ? "Mic not supported — type above" : "tap the text to edit before sending"}
      </p>

      {/* Actions */}
      <div className="flex gap-3 mt-2">
        <button
          onClick={() => {
            stopListening();
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            if (divRef.current) divRef.current.textContent = "";
            onCancel();
          }}
          className="text-sm px-5 py-2 rounded-full border border-border bg-surface-1 hover:border-border-strong transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSend}
          className="text-sm px-5 py-2 rounded-full flex items-center gap-2 cursor-pointer"
          style={{
            backgroundColor: "var(--fill-accent)",
            color: "var(--on-accent)",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          Send
        </button>
      </div>
    </motion.div>
  );
}
