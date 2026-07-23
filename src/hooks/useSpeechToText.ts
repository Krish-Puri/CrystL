"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UseSpeechToTextOptions {
  onResult: (text: string) => void;
  onEnd?: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionType = any;

export type SttError = "not-allowed" | "no-speech" | "not-supported" | "network" | null;

/** Distinct from the runtime errors captured by onerror — this tracks start() failures. */
export type StartError = string | null;

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
  const [startError, setStartError] = useState<StartError>(null);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const transcriptRef = useRef("");
  const mountedRef = useRef(true);
  // Tracks whether we have initiated a start() call on the current recognition instance.
  // More reliable than checking recognition.state which can be stale in some browsers.
  const startedRef = useRef(false);
  // Tracks whether the user has started and not yet cancelled — used for auto-restart on onend.
  const shouldListenRef = useRef(false);

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
    if (recognitionRef.current) {
      console.info("[STT] getRecognition() → returning existing instance");
      return recognitionRef.current;
    }
    console.info("[STT] getRecognition() → creating new SpeechRecognition instance");

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

    recognitionRef.current = recognition;

    recognition.onstart = () => {
      console.info("[STT] onstart fired — browser STT active");
    };

    recognition.onend = () => {
      console.info("[STT] onend fired");
      startedRef.current = false;
      if (!mountedRef.current) return;
      // Auto-restart if user hasn't cancelled — Web Speech fires onend after every silence/pause
      if (shouldListenRef.current) {
        console.info("[STT] onend fired — auto-restarting");
        setTimeout(() => {
          if (!mountedRef.current || !shouldListenRef.current) return;
          try {
            startedRef.current = true;
            recognition.start();
          } catch (e) {
            console.warn("[STT] auto-restart catch:", e);
          }
        }, 50);
        return;
      }
      setIsListening(false);
      onEndRef.current?.();
    };

    recognition.onerror = (event: { error: string }) => {
      console.info(`[STT] onerror: ${event.error}`);
      if (!mountedRef.current) return;
      if (event.error === "not-allowed") {
        shouldListenRef.current = false;
      }
      // Reset startedRef so next startListening() can call recognition.start() fresh.
      // no-speech is a normal silence marker — don't reset for it so the auto-restart path clears it.
      if (event.error !== "no-speech") {
        startedRef.current = false;
      }
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

    return recognition;
  }, []);

  const startListening = useCallback(() => {
    console.info("[STT] startListening() called");
    const recognition = getRecognition();
    if (!recognition) {
      console.info("[STT] startListening() → getRecognition returned null (not supported)");
      return;
    }
    transcriptRef.current = "";
    setStartError(null);
    setError(null);
    shouldListenRef.current = true;

    // If we already initiated start() on this instance (React Strict Mode double-mount),
    // the recognition is running — claim listening state and return. Using a ref avoids
    // relying on recognition.state which can be stale in some browsers.
    if (startedRef.current) {
      console.info("[STT] startListening() → already started, claiming isListening=true");
      setIsListening(true);
      return;
    }

    try {
      recognition.start();
      console.info("[STT] recognition.start() succeeded, startedRef = true");
      startedRef.current = true;
      setIsListening(true);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.name === "InvalidStateError" || err.message.includes("already started"))
      ) {
        // Recognition is running from a prior call — claim it
        console.info("[STT] recognition.start() → already started (InvalidStateError), claiming it");
        startedRef.current = true;
        setIsListening(true);
        return;
      }
      // Genuine start failure — surface it
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[STT] recognition.start() FAILED: ${msg}`);
      setStartError(msg);
    }
  }, [getRecognition]);

  /**
   * Stop current recognition, create a fresh instance, and restart.
   * Use after a network error to give the user a clean retry.
   */
  const retry = useCallback(() => {
    console.info("[STT] retry() → aborting current, creating fresh instance");
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
      console.info("[STT] retry() → SpeechRecognition not supported");
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

    newRecognition.onstart = () => {
      console.info("[STT] retry() → new recognition onstart fired");
    };

    newRecognition.onend = () => {
      console.info("[STT] retry() → new recognition onend fired");
      startedRef.current = false;
      if (!mountedRef.current) return;
      if (shouldListenRef.current) {
        console.info("[STT] retry() → new recognition onend fired — auto-restarting");
        startedRef.current = true;
        newRecognition.start();
        return;
      }
      setIsListening(false);
      onEndRef.current?.();
    };

    newRecognition.onerror = (event: { error: string }) => {
      console.info(`[STT] retry() → onerror: ${event.error}`);
      if (!mountedRef.current) return;
      if (event.error !== "no-speech") {
        startedRef.current = false;
      }
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
    startedRef.current = false;
    transcriptRef.current = "";
    setStartError(null);
    setError(null);
    console.info("[STT] retry() → calling newRecognition.start()");
    try {
      newRecognition.start();
      startedRef.current = true;
      setIsListening(true);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.name === "InvalidStateError" || err.message.includes("already started"))
      ) {
        // abort() is asynchronous — defer start to the next tick
        setTimeout(() => {
          console.info("[STT] retry() setTimeout → calling newRecognition.start()");
          try {
            newRecognition.start();
            startedRef.current = true;
            setIsListening(true);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error("[STT] retry() restart FAILED:", msg);
            setStartError(msg);
          }
        }, 0);
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[STT] retry() start FAILED:", msg);
      setStartError(msg);
    }
  }, []);

  const stopListening = useCallback(() => {
    console.info("[STT] stopListening() called → shouldListenRef = false, startedRef = false");
    shouldListenRef.current = false;
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

  return { isListening, isSupported, error, startError, startListening, stopListening, syncTranscript, retry };
}
