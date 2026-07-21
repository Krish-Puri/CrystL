"use client";
import { motion } from "framer-motion";

interface LoadingStateProps {
  message?: string;
  /** When set, shows a live countdown of seconds remaining instead of dots. */
  countdownSeconds?: number | null;
}

export default function LoadingState({
  message = "I'm thinking…",
  countdownSeconds,
}: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {countdownSeconds != null
          ? `Too many requests — retrying in ${countdownSeconds}s`
          : message}
      </p>
      {countdownSeconds == null ? (
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <div
            className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <div
            className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      ) : (
        <motion.div
          key={countdownSeconds}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
          style={{ borderColor: "var(--border-accent)" }}
        >
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            {countdownSeconds}
          </span>
        </motion.div>
      )}
    </div>
  );
}
