"use client";
import { motion } from "framer-motion";

interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({
  message = "I'm thinking…",
}: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p
        className="text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        {message}
      </p>
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
    </div>
  );
}
