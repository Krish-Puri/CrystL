"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UseSpeechToTextOptions {
  onResult: (text: string) => void;
  onEnd?: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionType = any;

export type SttError = "not-allowed" | "no-speech" | "not-supported" | "network" | null;

/**
 * Speech-to-text hook with lazy on-demand recognition.
 *
 * The SpeechRecognition instance is created inside startListening() on first call,
 * eliminating the race condition where startListening() was called before the
 * setup useEffect had created the instance.
 *
 * Call syncTranscript(text) when the user manually edits the transcript so
 * the hook's internal accumulator stays in sync with the DOM.
 */
export function useSpeechToText({ onResult, onEnd }: UseSpeechToTextOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    const win = window as Window & {
      webkitSpeechRecognition?: SpeechRecognitionType;
      SpeechRecognition?: SpeechRecognitionType;
    };
    return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  });
  const [error, setError] = useState<SttError>(null);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const transcriptRef = useRef("");
  const mountedRef = useRef(true);
  // Tracks whether we have initiated a start() call on the current recognition instance.
  // More reliable than checking recognition.state which can be stale in some browsers.
  const startedRef = useRef(false);

  // Keep callback refs stable across re-renders
  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onResultRef.current = onResult;
    onEndRef.current = onEnd;
  });

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      startedRef.current = false;
      recognitionRef.current?.abort();
    };
  }, []);

  /**
   * Lazily gets or creates the SpeechRecognition instance.
   * Created on first startListening() call — no useEffect race.
   */
  const getRecognition = useCallback((): SpeechRecognitionType | null => {
    if (recognitionRef.current) return recognitionRef.current;

    if (typeof window === "undefined") return null;
    const win = window as Window & {
      webkitSpeechRecognition?: SpeechRecognitionType;
      SpeechRecognition?: SpeechRecognitionType;
    };
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) {
      setIsSupported(false);
      return null;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: {
      resultIndex: number;
      results: Array<{ isFinal: boolean; 0: { transcript: string } }>;
    }) => {
      let interimPart = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          transcriptRef.current += t;
        } else {
          interimPart = t;
        }
      }
      if (mountedRef.current) {
        onResultRef.current(transcriptRef.current + interimPart);
      }
    };

    recognition.onend = () => {
      if (!mountedRef.current) return;
      setIsListening(false);
      onEndRef.current?.();
    };

    recognition.onerror = (event: { error: string }) => {
      if (!mountedRef.current) return;
      const errMap: Record<string, SttError> = {
        "not-allowed": "not-allowed",
        "no-speech": "no-speech",
        "not-supported": "not-supported",
        "network": "network",
      };
      const mapped = errMap[event.error] ?? null;
      setError(mapped);
      if (event.error !== "no-speech" && event.error !== "aborted" && event.error !== "network") {
        console.error("[STT] recognition error:", event.error);
      }
      setIsListening(false);
      onEndRef.current?.();
    };

    recognitionRef.current = recognition;
    return recognition;
  }, []);

  const startListening = useCallback(() => {
    const recognition = getRecognition();
    if (!recognition) return;
    transcriptRef.current = "";
    setError(null);

    // If we already initiated start() on this instance (React Strict Mode double-mount),
    // the recognition is running — claim listening state and return. Using a ref avoids
    // relying on recognition.state which can be stale in some browsers.
    if (startedRef.current) {
      setIsListening(true);
      return;
    }

    try {
      recognition.start();
      startedRef.current = true;
      setIsListening(true);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.name === "InvalidStateError" || err.message.includes("already started"))
      ) {
        startedRef.current = true;
        setIsListening(true);
        return;
      }
      console.error("[STT] start error:", err);
    }
  }, [getRecognition]);

  /**
   * Stop current recognition, create a fresh instance, and restart.
   * Use after a network error to give the user a clean retry.
   */
  const retry = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.abort();
    }

    const win = window as Window & {
      webkitSpeechRecognition?: SpeechRecognitionType;
      SpeechRecognition?: SpeechRecognitionType;
    };
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) {
      setIsSupported(false);
      return;
    }

    const newRecognition = new SR();
    newRecognition.continuous = true;
    newRecognition.interimResults = true;
    newRecognition.lang = "en-US";
    newRecognition.maxAlternatives = 1;

    newRecognition.onresult = (event: {
      resultIndex: number;
      results: Array<{ isFinal: boolean; 0: { transcript: string } }>;
    }) => {
      let interimPart = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          transcriptRef.current += t;
        } else {
          interimPart = t;
        }
      }
      if (mountedRef.current) {
        onResultRef.current(transcriptRef.current + interimPart);
      }
    };

    newRecognition.onend = () => {
      if (!mountedRef.current) return;
      setIsListening(false);
      onEndRef.current?.();
    };

    newRecognition.onerror = (event: { error: string }) => {
      if (!mountedRef.current) return;
      const errMap: Record<string, SttError> = {
        "not-allowed": "not-allowed",
        "no-speech": "no-speech",
        "not-supported": "not-supported",
        "network": "network",
      };
      const mapped = errMap[event.error] ?? null;
      setError(mapped);
      if (event.error === "network") {
        console.warn("[STT] speech service unreachable:", event.error);
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        console.error("[STT] recognition error:", event.error);
      }
      setIsListening(false);
      onEndRef.current?.();
    };

    recognitionRef.current = newRecognition;
    transcriptRef.current = "";
    setError(null);
    try {
      newRecognition.start();
      setIsListening(true);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.name === "InvalidStateError" || err.message.includes("already started"))
      ) {
        // abort() is asynchronous — defer start to the next tick so the browser
        // completes the state transition before we call start() again.
        setTimeout(() => {
          try {
            newRecognition.start();
            setIsListening(true);
          } catch (e) {
            console.error("[STT] retry restart failed:", e);
          }
        }, 0);
        return;
      }
      console.error("[STT] retry start failed:", err);
    }
  }, []);

  const stopListening = useCallback(() => {
    startedRef.current = false;
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // ignore
    }
  }, []);

  /**
   * Call this when the user manually edits the transcript so the hook
   * does not overwrite their edit with the next interim result.
   */
  const syncTranscript = useCallback((text: string) => {
    transcriptRef.current = text;
  }, []);

  return { isListening, isSupported, error, startListening, stopListening, syncTranscript, retry };
}
