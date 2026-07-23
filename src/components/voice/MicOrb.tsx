"use client";

import { motion } from "framer-motion";

interface MicOrbProps {
  /** Called when the user clicks the orb — opens the panel. */
  onClick: () => void;
  /**
   * Called immediately on click, before the panel mounts.
   * Use this to start STT from the click gesture rather than deferring to a mount effect.
   */
  onActivate?: () => void;
  size?: number;
  disabled?: boolean;
  isListening?: boolean;
}

export function MicOrb({ onClick, onActivate, size = 88, disabled = false, isListening = false }: MicOrbProps) {
  function handleClick() {
    console.info("[MicOrb] clicked");
    if (onActivate) {
      console.info("[MicOrb] calling onActivate()");
      onActivate();
    }
    onClick();
  }

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      animate={isListening ? {
        scale: [1, 1.04, 1],
      } : {}}
      transition={isListening ? {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      } : { duration: 0.15 }}
      onClick={disabled ? undefined : handleClick}
      disabled={disabled}
      aria-label="Hold to speak"
      className={`
        rounded-full flex items-center justify-center cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      style={{
        width: size,
        height: size,
        backgroundColor: isListening ? "var(--fill-accent-light, #4a9eff)" : "var(--fill-accent)",
      }}
    >
      {isListening && (
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 4}
          fill="none"
          stroke="var(--on-accent)"
          strokeWidth={2}
          opacity={0}
          animate={{
            opacity: [0, 0.5, 0],
            scale: [1, 1.5, 1.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      )}
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
