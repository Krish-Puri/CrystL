"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface AIMessageProps {
  content: string;
  showReplay?: boolean;
}

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.5,
      delayChildren: 0.3,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

export function AIMessage({ content, showReplay = true }: AIMessageProps) {
  const [revealed, setRevealed] = useState(false);
  const paragraphs = content.split("\n").filter(Boolean);

  useEffect(() => {
    setRevealed(false);
    const timer = setTimeout(() => setRevealed(true), 50);
    return () => clearTimeout(timer);
  }, [content]);

  function replay() {
    setRevealed(false);
    setTimeout(() => setRevealed(true), 50);
  }

  return (
    <div className="border-t border-border-subtle py-4 flex-1">
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-sm text-secondary"
          style={{ fontFamily: "var(--font-voice)" }}
        >
          Haven
        </span>
        {showReplay && (
          <button
            onClick={replay}
            className="text-xs px-2 py-1 rounded hover:bg-surface-2 transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
          >
            ↻ Replay
          </button>
        )}
      </div>

      {revealed ? (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-2.5"
        >
          {paragraphs.map((para, i) => (
            <motion.p
              key={i}
              variants={item}
              className="text-base leading-relaxed"
              style={{ fontFamily: "var(--font-voice)" }}
            >
              {para}
            </motion.p>
          ))}
        </motion.div>
      ) : (
        <div className="space-y-2.5">
          {paragraphs.map((_, i) => (
            <div
              key={i}
              className="h-4 rounded bg-surface-2 animate-pulse"
            />
          ))}
        </div>
      )}
    </div>
  );
}
