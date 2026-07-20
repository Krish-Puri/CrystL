"use client";

import { motion } from "framer-motion";

interface SafetyOverlayProps {
  onContinueTalking: () => void;
  onGrounding: () => void;
}

const CRISIS_RESOURCES = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z" />
      </svg>
    ),
    label: "Talk to a crisis counselor now",
    sublabel: "Available 24/7",
    primary: true,
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z" />
      </svg>
    ),
    label: "KIRAN Helpline",
    sublabel: "1800-599-0019",
    primary: false,
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    label: "Continue talking with me",
    sublabel: "I'm still here",
    primary: false,
  },
];

export function SafetyOverlay({ onContinueTalking, onGrounding }: SafetyOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center text-center px-8 py-16 h-full"
      style={{ backgroundColor: "var(--surface-accent)" }}
    >
      {/* Icon */}
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
        style={{ backgroundColor: "var(--fill-accent)", opacity: 0.15 }}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-accent)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </div>

      {/* Main message */}
      <p
        className="text-xl mb-1 max-w-sm"
        style={{ fontFamily: "var(--font-voice)", color: "var(--text-accent)" }}
      >
        I&apos;m really glad you told me.
      </p>
      <p className="text-sm text-secondary mb-1 max-w-sm">
        You don&apos;t have to carry this by yourself.
      </p>
      <p className="text-sm text-secondary mb-6 max-w-sm">
        Let&apos;s slow things down together.
      </p>

      <p className="text-sm font-medium mb-5 max-w-sm" style={{ color: "var(--text-accent)" }}>
        If you&apos;re in immediate danger, please reach out to someone now.
      </p>

      {/* Resources */}
      <div className="flex flex-col gap-2.5 w-full max-w-xs mb-6">
        {CRISIS_RESOURCES.map((resource) =>
          resource.label === "Continue talking with me" ? (
            <button
              key={resource.label}
              onClick={onContinueTalking}
              className="
                flex items-center gap-3 p-3 rounded-xl
                bg-surface-1 border border-border
                hover:border-border-strong transition-colors cursor-pointer text-left w-full
              "
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "var(--surface-accent)" }}
              >
                {resource.icon}
              </div>
              <div>
                <p className="text-sm font-medium">{resource.label}</p>
                <p className="text-xs text-muted-foreground">{resource.sublabel}</p>
              </div>
            </button>
          ) : (
            <div
              key={resource.label}
              className={`
                flex items-center gap-3 p-3 rounded-xl
                bg-surface-1 border border-border
              `}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "var(--surface-accent)" }}
              >
                {resource.icon}
              </div>
              <div>
                <p className="text-sm font-medium">{resource.label}</p>
                <p className="text-xs text-muted-foreground">{resource.sublabel}</p>
              </div>
            </div>
          )
        )}

        {/* Grounding */}
        <button
          onClick={onGrounding}
          className="
            flex items-center gap-3 p-3 rounded-xl
            bg-surface-1 border border-border
            hover:border-border-strong transition-colors cursor-pointer text-left w-full
          "
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
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
            <p className="text-sm font-medium">Try a grounding exercise together</p>
            <p className="text-xs text-muted-foreground">5-4-3-2-1 or breathing</p>
          </div>
        </button>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground max-w-xs">
        This is a support space, not a substitute for professional care.
      </p>
    </motion.div>
  );
}
