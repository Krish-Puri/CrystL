"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";

interface RecordingPanelProps {
  onSend: (text: string) => void;
  onTranscriptChange?: (text: string) => void;
  onCancel: () => void;
  panelDivRef: React.MutableRefObject<HTMLDivElement | null>;
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  startError: string | null;
  startListening: () => void;
  stopListening: () => void;
  syncTranscript: (text: string) => void;
  retry: () => void;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Strip common Whisper silence hallucinations:
 * - Repetitive "Thank you." patterns
 * - Metadata artifacts like "Subtitles by...", "[Applause]", etc.
 */
function cleanWhisperText(text: string): string {
  if (!text || !text.trim()) return "";

  let cleaned = text.trim();

  // Remove common metadata artifacts
  const metadataPatterns = [
    /subtitles by.*$/i,
    /\[applause\]/gi,
    /\[music\]/gi,
    /\[laughter\]/gi,
    /\[鼓掌\]/g,
    /\[拍手\]/g,
    /\[silence\]/gi,
  ];
  for (const pattern of metadataPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Remove repetitive "Thank you." patterns — keep at most one
  // e.g. "Thank you. Thank you. Thank you." → "Thank you."
  cleaned = cleaned.replace(/((thank you[\.!]\s*)+)/gi, "Thank you. ");

  // Remove any trailing repetition of the same short phrase (2 words or fewer appearing 3+ times)
  const trailingRepeat = cleaned.match(/((\b\S+\b\s*){1,2})\1{2,}$/);
  if (trailingRepeat) {
    cleaned = cleaned.slice(0, trailingRepeat.index ?? 0).trim();
  }

  return cleaned.trim();
}

export function RecordingPanel({
  onSend,
  onTranscriptChange,
  onCancel,
  panelDivRef,
  isListening,
  isSupported,
  error,
  startError,
  startListening,
  stopListening,
  syncTranscript,
  retry,
}: RecordingPanelProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync internal divRef → parent's panelDivRef
  useEffect(() => {
    panelDivRef.current = divRef.current;
  }, [panelDivRef]);

  // Mount/unmount logging + stop listening on unmount
  useEffect(() => {
    console.info("[RecordingPanel] mounted");
    return () => {
      console.info("[RecordingPanel] unmounting");
      stopListening();
    };
  }, [stopListening]);

  // Timer — only runs while actively listening; guarded so it never starts on a stray mount
  useEffect(() => {
    if (!isListening) {
      // Reset elapsed time when not listening so stale seconds never flash on screen
      setElapsedTime(0);
      return;
    }
    timerRef.current = setInterval(() => {
      setElapsedTime((t) => t + 1);
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isListening]);

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0); // 0–100
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Start MediaRecorder audio capture in parallel for robust Whisper STT fallback
  useEffect(() => {
    if (typeof window === "undefined") return;

    let stream: MediaStream | null = null;

    // Defensive: navigator.mediaDevices may be null in Brave Shields / some browsers
    if (!navigator.mediaDevices) {
      setAudioError("Audio input not available — browser may be blocking microphone access.");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        console.info("[MediaRecorder] getUserMedia success, stream active");
        stream = s;

        // ── Web Audio API: real-time volume analyser ──────────────────────
        const audioCtx = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
        if (audioCtx.state === "suspended") {
          audioCtx.resume();
        }
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        const source = audioCtx.createMediaStreamSource(s);
        source.connect(analyser);
        const dataArr = new Uint8Array(analyser.frequencyBinCount);
        audioCtxRef.current = audioCtx;

        function updateVolume() {
          analyser.getByteFrequencyData(dataArr);
          const avg = dataArr.reduce((a, b) => a + b, 0) / dataArr.length;
          setVolumeLevel(Math.round((avg / 128) * 100));
          animationRef.current = requestAnimationFrame(updateVolume);
        }
        animationRef.current = requestAnimationFrame(updateVolume);
        // ────────────────────────────────────────────────────────────────

        const mr = new MediaRecorder(s);
        audioChunksRef.current = [];
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mr.start();
        mediaRecorderRef.current = mr;
        setAudioError(null);
      })
      .catch((err) => {
        console.error(`[MediaRecorder] getUserMedia FAILED: ${err.name} ${err.message}`);
        setAudioError(
          err.name === "NotAllowedError"
            ? "Microphone access denied — please allow mic access in browser settings."
            : "Audio input not available."
        );
      });

    return () => {
      if (animationRef.current != null) cancelAnimationFrame(animationRef.current);
      audioCtxRef.current?.close();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleTranscribeAudio = useCallback(async () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    setIsTranscribing(true);

    try {
      const audioBlob = await new Promise<Blob>((resolve) => {
        mr.onstop = () => {
          resolve(new Blob(audioChunksRef.current, { type: "audio/webm" }));
        };
        if (mr.state !== "inactive") {
          mr.stop();
        } else {
          resolve(new Blob(audioChunksRef.current, { type: "audio/webm" }));
        }
      });

      if (audioBlob.size > 0) {
        const formData = new FormData();
        formData.append("file", audioBlob, "recording.webm");

        console.info("[RecordingPanel] POST /api/stt — sending audio for Whisper transcription");
        const res = await fetch("/api/stt", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          const cleaned = cleanWhisperText(data.text ?? "");
          if (cleaned && divRef.current) {
            divRef.current.textContent = cleaned;
            syncTranscript(cleaned);
          }
        } else {
          const detail = await res.text();
          console.error(`[RecordingPanel] /api/stt returned ${res.status}:`, detail);
        }
      }
    } catch (e) {
      console.error("[RecordingPanel] Whisper fallback error:", e);
    } finally {
      setIsTranscribing(false);
    }
  }, [syncTranscript]);

  // Sync manual edits back to the hook so they aren't overwritten
  const handleInput = useCallback(() => {
    const text = divRef.current?.textContent ?? "";
    syncTranscript(text);
    onTranscriptChange?.(text);
  }, [syncTranscript, onTranscriptChange]);

  /**
   * Send the current transcript. If empty but audio is available (network error case),
   * auto-trigger Whisper transcription first, then send the result.
   */
  const handleSend = useCallback(async () => {
    const text = divRef.current?.textContent?.trim() ?? "";

    // If transcript is empty but audio is recorded and Whisper is available, transcribe first
    if (!text && mediaRecorderRef.current && !audioError) {
      const mr = mediaRecorderRef.current;
      setIsTranscribing(true);

      try {
        const audioBlob = await new Promise<Blob>((resolve) => {
          mr.onstop = () => {
            resolve(new Blob(audioChunksRef.current, { type: "audio/webm" }));
          };
          if (mr.state !== "inactive") {
            mr.stop();
          } else {
            resolve(new Blob(audioChunksRef.current, { type: "audio/webm" }));
          }
        });

        if (audioBlob.size > 0) {
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.webm");

          const res = await fetch("/api/stt", { method: "POST", body: formData });
          if (res.ok) {
            const data = await res.json();
            const cleaned = cleanWhisperText(data.text ?? "");
            if (cleaned && divRef.current) {
              divRef.current.textContent = cleaned;
              syncTranscript(cleaned);
              stopListening();
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              onCancel();
              onSend(cleaned);
              if (divRef.current) divRef.current.textContent = "";
              setIsTranscribing(false);
              return;
            }
          }
        }
      } catch (e) {
        console.error("[RecordingPanel] auto-Whisper send error:", e);
      } finally {
        setIsTranscribing(false);
      }
    }

    if (!text) return;
    stopListening();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    onCancel();
    onSend(text);
    if (divRef.current) divRef.current.textContent = "";
  }, [audioError, syncTranscript, onCancel, onSend]);

  const isPermissionDenied = error === "not-allowed";
  const isNetworkError = error === "network";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center h-full gap-7 px-10 py-16"
    >
      {/* Pulsing mic + audio visualizer */}
      <div className="relative flex items-center justify-center w-28 h-28">
        {isListening && (
          <div
            className="absolute inset-0 rounded-full pulse-ring"
            style={{ border: "1.5px solid var(--border-accent)" }}
          />
        )}
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
          {/* 5-bar audio visualizer — animated bars responding to voice volume */}
          {isListening && (
            <div className="absolute inset-0 flex items-center justify-center gap-1 pointer-events-none">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full"
                  style={{
                    height: `${4 + ((volumeLevel / 100) * 16) * (i % 2 === 0 ? 1 : 0.7)}px`,
                    backgroundColor: "var(--on-accent)",
                    opacity: volumeLevel > i * 20 ? 0.9 : 0.2,
                    transition: "height 80ms ease-out, opacity 80ms ease-out",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <p className="text-sm text-muted-foreground">
        {isTranscribing
          ? "Transcribing voice note with AI…"
          : isPermissionDenied
          ? "Microphone access blocked"
          : isNetworkError
          ? "Speech service unreachable"
          : isListening
          ? "Listening"
          : ""}
        {isListening || isNetworkError ? " · " : ""}
        {!isTranscribing && formatTime(elapsedTime)}
      </p>

      {/* Error / Fallback banner */}
      {(isPermissionDenied || isNetworkError || audioError || startError) && (
        <div className="w-full max-w-md rounded bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-center text-red-400 flex flex-col gap-2 items-center">
          <span>
            {isPermissionDenied
              ? "Microphone access blocked — please allow mic access in browser settings."
              : isNetworkError
              ? "Browser speech service unreachable (e.g. Brave blocks Google Speech servers)."
              : startError
              ? `Mic failed to start: ${startError}`
              : audioError ?? ""}
          </span>
          {isNetworkError && !audioError && !startError && (
            <button
              onClick={handleTranscribeAudio}
              disabled={isTranscribing}
              className="text-xs px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              {isTranscribing ? "Transcribing…" : "✦ Transcribe with AI Whisper"}
            </button>
          )}
          {audioError && (
            <span className="text-xs opacity-70">Voice transcription unavailable in this browser.</span>
          )}
        </div>
      )}

      {/* Editable transcript */}
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder="Listening... Speak now or type your message..."
        className="
          w-full max-w-md min-h-[72px]
          font-voice text-xl leading-relaxed text-center
          outline-none py-1 px-2 rounded
          hover:bg-surface-2 focus:bg-surface-2
          transition-colors cursor-text
          empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50
        "
        style={{ fontFamily: "var(--font-voice)" }}
      />

      <p className="text-xs text-muted-foreground -mt-5">
        {!isSupported
          ? "Mic not supported — type above"
          : isPermissionDenied
          ? "mic access required"
          : isNetworkError
          ? "internet connection required"
          : audioError
          ? "voice unavailable in this browser"
          : startError
          ? "mic failed to start"
          : "tap the text to edit before sending"}
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
