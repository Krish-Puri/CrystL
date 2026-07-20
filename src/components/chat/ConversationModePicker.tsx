"use client";

import { motion } from "framer-motion";
import type { ConversationMode } from "@/types";

interface Mode {
  value: ConversationMode;
  label: string;
  description: string;
}

const MODES: Mode[] = [
  {
    value: "vent",
    label: "Just listen",
    description: "I just want to be heard",
  },
  {
    value: "reflection",
    label: "Help me think it through",
    description: "I want to reflect on something",
  },
  {
    value: "advice",
    label: "Suggest a next step",
    description: "I could use a small suggestion",
  },
  {
    value: "default",
    label: "Just be here",
    description: "I'm not sure — just be with me",
  },
];

interface ConversationModePickerProps {
  onSelect: (mode: ConversationMode) => void;
}

export function ConversationModePicker({ onSelect }: ConversationModePickerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="py-2"
    >
      <p className="text-sm text-secondary mb-3">
        What would help most right now?
      </p>
      <div className="flex flex-col gap-2">
        {MODES.map((mode) => (
          <motion.button
            key={mode.value}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ duration: 0.15 }}
            onClick={() => onSelect(mode.value)}
            className="
              flex flex-col items-start gap-0.5 px-4 py-3 rounded-xl
              border border-border bg-surface-1
              hover:border-border-strong hover:bg-surface-2
              transition-colors cursor-pointer text-left
            "
          >
            <span className="text-sm font-medium">{mode.label}</span>
            <span className="text-xs text-muted-foreground">{mode.description}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
