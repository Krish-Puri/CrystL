"use client";

import { motion } from "framer-motion";
import { MoodPickerIcon } from "@/components/icons/MoodPickerIcons";

interface Mood {
  value: "calm" | "okay" | "low" | "sad" | "overwhelmed";
  label: string;
}

const MOODS: Mood[] = [
  { value: "calm", label: "Calm" },
  { value: "okay", label: "Okay" },
  { value: "low", label: "Low" },
  { value: "sad", label: "Sad" },
  { value: "overwhelmed", label: "Overwhelmed" },
];

interface MoodPickerProps {
  onSelect: (mood: Mood["value"]) => void;
  selected?: Mood["value"] | null;
}

export function MoodPicker({ onSelect, selected }: MoodPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {MOODS.map((mood) => (
        <motion.button
          key={mood.value}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.15 }}
          onClick={() => onSelect(mood.value)}
          className={`
            inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm
            transition-colors duration-150 cursor-pointer
            ${
              selected === mood.value
                ? "border-accent bg-surface-accent text-accent-foreground"
                : "border-border bg-surface-1 text-secondary-foreground hover:border-border-strong"
            }
          `}
        >
          <MoodPickerIcon mood={mood.value} />
          {mood.label}
        </motion.button>
      ))}
    </div>
  );
}
