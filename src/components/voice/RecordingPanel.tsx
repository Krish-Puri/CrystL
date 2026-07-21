"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";

interface RecordingPanelProps {
  isListening: boolean;
  elapsedTime: number; // seconds
  onSend: (text: string) => void;
  onCancel: () => void;
  // Mutable ref to the contentEditable div, shared with the parent so
  // the parent can clear it before starting a new recording session.
  panelDivRef: React.MutableRefObject<HTMLDivElement | null>;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function RecordingPanel({
  isListening,
  elapsedTime,
  onSend,
  onCancel,
  panelDivRef,
}: RecordingPanelProps) {
  const divRef = useRef<HTMLDivElement>(null);

  // Keep the parent's ref in sync with our internal ref.
  // This lets CrystLApp clear the div before starting a new recording.
  useEffect(() => {
    panelDivRef.current = divRef.current;
  }, [panelDivRef]);

  function handleSend() {
    const text = divRef.current?.textContent?.trim() ?? "";
    if (!text) return;
    onSend(text);
    // Clear the div after sending
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
        {/* Pulse ring */}
        <div
          className="absolute inset-0 rounded-full pulse-ring"
          style={{ border: "1.5px solid var(--border-accent)" }}
        />
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

      {/* Status */}
      <p className="text-sm text-muted-foreground">
        {isListening ? "Listening · " : ""}
        {formatTime(elapsedTime)}
      </p>

      {/* Editable transcript — user types here; voice pushes directly into this div via DOM.
          We never pass transcript as a prop or React-rendered child, so React never
          overwrites user input. */}
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
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
        tap the text to edit before sending
      </p>

      {/* Actions */}
      <div className="flex gap-3 mt-2">
        <button
          onClick={onCancel}
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
