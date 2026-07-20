"use client";

import { motion } from "framer-motion";

interface MicOrbProps {
  onClick: () => void;
  size?: number;
  disabled?: boolean;
}

export function MicOrb({ onClick, size = 88, disabled = false }: MicOrbProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      transition={{ duration: 0.15 }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label="Hold to speak"
      className={`
        rounded-full flex items-center justify-center cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      style={{
        width: size,
        height: size,
        backgroundColor: "var(--fill-accent)",
      }}
    >
      {/* Microphone icon */}
      <svg
        width={size * 0.36}
        height={size * 0.36}
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
    </motion.button>
  );
}
