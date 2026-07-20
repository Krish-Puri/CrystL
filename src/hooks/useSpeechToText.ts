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
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const transcriptRef = useRef("");

  useEffect(() => {
    const win = window as Window & {
      webkitSpeechRecognition?: SpeechRecognitionType;
      SpeechRecognition?: SpeechRecognitionType;
    };
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (SR) {
      setIsSupported(true);
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: { resultIndex: number; results: Array<{ isFinal: boolean; 0: { transcript: string } }> }) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }
        if (finalTranscript) {
          transcriptRef.current += finalTranscript;
          onResult(transcriptRef.current);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        onEnd?.();
      };

      recognition.onerror = (event: { error: string }) => {
        console.error("STT error:", event.error);
        setIsListening(false);
        onEnd?.();
      };

      recognitionRef.current = recognition;
    }
  }, [onResult, onEnd]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    transcriptRef.current = "";
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // Already started
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // Already stopped
    }
  }, []);

  return { isListening, isSupported, startListening, stopListening };
}
