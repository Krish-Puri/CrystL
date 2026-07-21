"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReflectionDraft, Mood } from "@/types";
import { trackEvent } from "@/lib/analytics";

interface ReflectionDraftSheetProps {
  draft: ReflectionDraft;
  onSave: (editedContent: string) => Promise<void>;
  onRegenerate: () => Promise<void>;
  onDiscard: () => Promise<void>;
}

// Convert slug to display name: "presentation-anxiety" → "Presentation Anxiety"
function slugToDisplay(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const MOOD_LABELS: Record<Mood, string> = {
  calm: "Calm",
  okay: "Okay",
  low: "Low",
  sad: "Sad",
  overwhelmed: "Overwhelmed",
};

export function ReflectionDraftSheet({
  draft,
  onSave,
  onRegenerate,
  onDiscard,
}: ReflectionDraftSheetProps) {
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(draft.content);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(editing ? editedContent : draft.content);
      trackEvent("reflection_saved", {
        was_edited: editing,
        was_regenerated: false,
        theme: draft.theme_slug,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await onRegenerate();
      trackEvent("reflection_regenerated", { theme: draft.theme_slug });
    } finally {
      setRegenerating(false);
      setEditing(false);
    }
  }

  async function handleDiscard() {
    setDiscarding(true);
    try {
      await onDiscard();
      trackEvent("reflection_discarded", { theme: draft.theme_slug });
    } finally {
      setDiscarding(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        className="
          fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl
          flex flex-col gap-5 px-6 py-7 pb-10
          border-t border-border shadow-2xl
        "
        style={{ backgroundColor: "var(--surface-1)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span
            className="text-base font-semibold"
            style={{ fontFamily: "var(--font-voice)" }}
          >
            Your reflection
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{
                backgroundColor: "var(--surface-accent)",
                color: "var(--text-accent)",
              }}
            >
              {slugToDisplay(draft.theme_slug)}
            </span>
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
            >
              {MOOD_LABELS[draft.mood]}
            </span>
          </div>
        </div>

        {/* Reflection content */}
        <div className="flex flex-col gap-2">
          {editing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={4}
              className="
                w-full rounded-xl px-4 py-3 text-sm leading-relaxed
                bg-surface-2 border border-border resize-none
                text-foreground placeholder:text-muted-foreground
                focus:outline-none focus:border-border-strong
              "
              style={{ backgroundColor: "var(--surface-2)" }}
              placeholder="Edit your reflection..."
            />
          ) : (
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {draft.content}
            </p>
          )}
        </div>

        {/* Next step */}
        {draft.next_step && !editing && (
          <div
            className="flex items-start gap-2.5 p-3 rounded-xl"
            style={{ backgroundColor: "var(--surface-accent)", opacity: 0.6 }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 shrink-0"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <p className="text-xs" style={{ color: "var(--text-accent)" }}>
              {draft.next_step}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          {/* Primary row */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="
                flex-1 py-3 rounded-xl text-sm font-medium
                bg-primary text-primary-foreground
                hover:opacity-90 transition-opacity
                disabled:opacity-50 cursor-pointer
              "
            >
              {saving ? "Saving…" : editing ? "Save edit" : "Save reflection"}
            </button>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="
                flex-1 py-3 rounded-xl text-sm font-medium
                border border-border hover:border-border-strong
                text-foreground transition-colors
                disabled:opacity-50 cursor-pointer
              "
            >
              {regenerating ? "Generating…" : "Regenerate"}
            </button>
          </div>

          {/* Secondary row */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (editing) {
                  setEditedContent(draft.content);
                  setEditing(false);
                } else {
                  setEditing(true);
                }
              }}
              disabled={saving || regenerating}
              className="
                flex-1 py-2.5 rounded-xl text-xs
                text-muted-foreground hover:text-foreground
                border border-transparent hover:border-border
                transition-colors disabled:opacity-50 cursor-pointer
              "
            >
              {editing ? "Cancel edit" : "Edit"}
            </button>
            <button
              onClick={handleDiscard}
              disabled={discarding}
              className="
                flex-1 py-2.5 rounded-xl text-xs
                text-muted-foreground hover:text-destructive
                border border-transparent hover:border-destructive/30
                transition-colors disabled:opacity-50 cursor-pointer
              "
            >
              {discarding ? "Discarding…" : "Discard"}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
