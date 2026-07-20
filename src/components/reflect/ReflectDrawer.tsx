"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import type { Reflection, ThemeTrendEntry } from "@/types";

interface ReflectDrawerProps {
  open: boolean;
  onClose: () => void;
  reflections?: Reflection[];
  themeTrends?: ThemeTrendEntry[];
  onGroundingExercise?: (type: string) => void;
}

const GROUNDING_EXERCISES = [
  { id: "breathing", label: "Breathing exercise", desc: "4-7-8 breathing" },
  { id: "54321", label: "5-4-3-2-1", desc: "Ground your senses" },
  { id: "body-scan", label: "Body scan", desc: "Release tension" },
];

export function ReflectDrawer({
  open,
  onClose,
  reflections = [],
  themeTrends = [],
  onGroundingExercise,
}: ReflectDrawerProps) {
  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.12)" }}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="
              fixed top-0 right-0 bottom-0 z-50 w-80
              flex flex-col gap-4 overflow-y-auto
              border-l border-border
            "
            style={{ backgroundColor: "var(--surface-2)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-7 pb-4">
              <span
                className="text-lg"
                style={{ fontFamily: "var(--font-voice)" }}
              >
                Reflect
              </span>
              <button
                onClick={onClose}
                aria-label="Close"
                className="
                  w-7 h-7 rounded-full flex items-center justify-center
                  hover:bg-surface-1 transition-colors cursor-pointer
                "
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="px-6 flex flex-col gap-6 pb-8">
              {/* Journal */}
              <section>
                <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">
                  Journal
                </p>
                {reflections.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    Your reflections will appear here after each session.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {reflections.slice(0, 5).map((r) => (
                      <div
                        key={r.id}
                        className="p-3 rounded-xl bg-surface-1 border border-border text-sm"
                      >
                        <p className="text-xs text-accent-foreground mb-1 font-medium">
                          {r.theme}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                          {r.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Mood history */}
              <section>
                <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">
                  Mood history
                </p>
                <div className="h-12 rounded-xl bg-surface-1 border border-border flex items-end gap-1 px-2 pb-2 overflow-hidden">
                  {/* Placeholder sparkline */}
                  {[0.6, 0.8, 0.5, 0.9, 0.7, 0.65, 0.85].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm"
                      style={{
                        height: `${h * 100}%`,
                        backgroundColor: "var(--fill-accent)",
                        opacity: 0.6,
                      }}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">Last 7 days</p>
              </section>

              {/* Grounding exercises */}
              <section>
                <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">
                  Grounding exercises
                </p>
                <div className="flex flex-col gap-1.5">
                  {GROUNDING_EXERCISES.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => onGroundingExercise?.(ex.id)}
                      className="
                        flex items-center gap-3 p-3 rounded-xl
                        bg-surface-1 border border-border
                        hover:border-border-strong transition-colors cursor-pointer text-left
                      "
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: "var(--surface-accent)" }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--text-accent)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9 18V5l12-2v13" />
                          <circle cx="6" cy="18" r="3" />
                          <circle cx="18" cy="16" r="3" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{ex.label}</p>
                        <p className="text-xs text-muted-foreground">{ex.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Timeline */}
              {themeTrends.length > 0 && (
                <section>
                  <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">
                    Timeline
                  </p>
                  <div className="flex flex-col gap-2">
                    {themeTrends.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-surface-1 border border-border"
                      >
                        <div>
                          <p className="text-sm font-medium">{t.theme}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.conversation_count} conversation
                            {t.conversation_count !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <TrendBadge trend={t.trend} />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Settings */}
              <section>
                <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">
                  Settings
                </p>
                <button
                  className="
                    flex items-center gap-3 p-3 w-full rounded-xl
                    bg-surface-1 border border-border
                    hover:border-border-strong transition-colors cursor-pointer text-left
                  "
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                  <span className="text-sm">Preferences</span>
                </button>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function TrendBadge({ trend }: { trend: ThemeTrendEntry["trend"] }) {
  const config = {
    improving: { arrow: "↑", color: "#4CAF50", label: "Improving" },
    stable: { arrow: "→", color: "var(--text-muted)", label: "Stable" },
    worsening: { arrow: "↓", color: "var(--destructive)", label: "Worsening" },
    new: { arrow: "●", color: "var(--text-accent)", label: "New" },
  };
  const { arrow, color } = config[trend];
  return (
    <span className="text-sm font-medium" style={{ color }}>
      {arrow}
    </span>
  );
}
