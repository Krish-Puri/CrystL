"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UseSpeechToTextOptions {
  onResult: (text: string) => void;
  onEnd?: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionType = any;

export function useSpeechToText({ onResult, onEnd }: UseSpeechToTextOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  // Store recognition instance in a ref so handlers can access the current one
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  // Accumulate transcript across interim results
  const transcriptRef = useRef("");
  // Guard against stale onResult calls after unmount
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      recognitionRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const win = window as Window & {
      webkitSpeechRecognition?: SpeechRecognitionType;
      SpeechRecognition?: SpeechRecognitionType;
    };
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    // Build a fresh recognition instance — needed because Chrome sometimes
    // misbehaves if you reuse an instance after it has ended/stopped.
    function createRecognition(): SpeechRecognitionType {
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: {
        resultIndex: number;
        results: Array<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += t;
          }
        }
        if (finalTranscript) {
          transcriptRef.current += finalTranscript;
        }
        // Always push current interim + accumulated final so user sees text updating
        if (mountedRef.current) {
          onResult(transcriptRef.current);
        }
      };

      recognition.onend = () => {
        if (!mountedRef.current) return;
        setIsListening(false);
        onEnd?.();
      };

      recognition.onerror = (event: { error: string }) => {
        if (!mountedRef.current) return;
        // 'no-speech' is normal — the user just hasn't spoken yet
        // 'aborted' means we stopped it ourselves via stopListening
        if (event.error !== "no-speech" && event.error !== "aborted") {
          console.error("[STT] recognition error:", event.error);
        }
        setIsListening(false);
        onEnd?.();
      };

      return recognition;
    }

    recognitionRef.current = createRecognition();
  }, [onResult, onEnd]);

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    transcriptRef.current = "";
    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      // If it's already running, abort and restart fresh
      if (err instanceof Error && err.message.includes("already started")) {
        recognition.abort();
        try {
          recognition.start();
          setIsListening(true);
        } catch {
          console.error("[STT] failed to restart:", err);
        }
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // ignore
    }
  }, []);

  return { isListening, isSupported, startListening, stopListening };
}
