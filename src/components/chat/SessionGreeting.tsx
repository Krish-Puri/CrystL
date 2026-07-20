"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MoodPicker } from "@/components/chat/MoodPicker";
import type { Mood } from "@/types";

interface SessionGreetingProps {
  variant: "first" | "returning";
  lastTheme?: string | null;
  onMoodSelect: (mood: Mood) => void;
  onStartFresh: () => void;
  onPickUp: () => void;
}

export function SessionGreeting({
  variant,
  lastTheme,
  onMoodSelect,
  onStartFresh,
  onPickUp,
}: SessionGreetingProps) {
  return (
    <AnimatePresence mode="wait">
      {variant === "first" ? (
        <motion.div
          key="greet-first"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <p
            className="font-voice text-xl mb-1"
            style={{ fontFamily: "var(--font-voice)" }}
          >
            Good evening.
          </p>
          <p className="text-sm text-secondary mb-4">
            I&apos;m here whenever you&apos;re ready.
          </p>
          <p className="text-sm text-secondary mb-3">How are you feeling right now?</p>
          <MoodPicker onSelect={onMoodSelect} />
        </motion.div>
      ) : (
        <motion.div
          key="greet-returning"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <p
            className="font-voice text-xl mb-1"
            style={{ fontFamily: "var(--font-voice)" }}
          >
            Welcome back.
          </p>
          {lastTheme && (
            <p className="text-sm text-secondary mb-4 leading-relaxed">
              Last time, you were {lastTheme}.
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onPickUp}
              className="text-sm px-4 py-2 rounded-full border border-border bg-surface-1 hover:border-border-strong transition-colors cursor-pointer"
            >
              Pick up from there
            </button>
            <button
              onClick={onStartFresh}
              className="text-sm px-4 py-2 rounded-full border border-border bg-surface-1 hover:border-border-strong transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              Start fresh
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
