"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface GroundingExerciseProps {
  onClose: () => void;
  initialExercise?: string;
}

type ExerciseId = "54321" | "breathing" | "body_scan";

const EXERCISES = [
  { id: "54321" as ExerciseId, label: "5-4-3-2-1", subtitle: "Ground your senses" },
  { id: "breathing" as ExerciseId, label: "Box Breathing", subtitle: "4-4-4-4 breathing" },
  { id: "body_scan" as ExerciseId, label: "Body Scan", subtitle: "Release tension" },
];

const STEPS_54321 = [
  { count: 5, prompt: "Name 5 things you can see" },
  { count: 4, prompt: "Name 4 things you can touch" },
  { count: 3, prompt: "Name 3 things you can hear" },
  { count: 2, prompt: "Name 2 things you can smell" },
  { count: 1, prompt: "Name 1 thing you can taste" },
];

const BOX_BREATHING_STEPS = [
  { label: "Inhale", duration: 4 },
  { label: "Hold", duration: 4 },
  { label: "Exhale", duration: 4 },
  { label: "Hold", duration: 4 },
];

// ── Main Component ────────────────────────────────────────────────────────────

export function GroundingExercise({ onClose, initialExercise }: GroundingExerciseProps) {
  const [selectedExercise, setSelectedExercise] = useState<ExerciseId | null>(
    initialExercise ? (initialExercise as ExerciseId) : null
  );

  if (!selectedExercise) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-sm rounded-2xl bg-surface-1 p-6 flex flex-col gap-5"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-base font-semibold text-foreground">Choose an exercise</h2>
          <div className="flex flex-col gap-2">
            {EXERCISES.map((ex) => (
              <button
                key={ex.id}
                onClick={() => setSelectedExercise(ex.id)}
                className="
                  flex items-center gap-3 p-4 rounded-xl
                  bg-surface-2 border border-border
                  hover:border-border-strong transition-colors cursor-pointer text-left
                "
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "var(--surface-accent)" }}
                >
                  <span className="text-sm font-semibold" style={{ color: "var(--text-accent)" }}>
                    {ex.label.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{ex.label}</p>
                  <p className="text-xs text-muted-foreground">{ex.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:border-border-strong transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </motion.div>
      </motion.div>
    );
  }

  if (selectedExercise === "54321") return <FiveFourThreeTwoOne onBack={() => setSelectedExercise(null)} />;
  if (selectedExercise === "breathing") return <BoxBreathing onBack={() => setSelectedExercise(null)} />;
  if (selectedExercise === "body_scan") return <BodyScan onBack={() => setSelectedExercise(null)} />;
  return null;
}

// ── 5-4-3-2-1 Exercise ─────────────────────────────────────────────────────────

function FiveFourThreeTwoOne({ onBack }: { onBack: () => void }) {
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  function handleDone(count: number) {
    setCompleted((prev) => new Set([...prev, count]));
  }

  const allDone = completed.size === STEPS_54321.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-sm rounded-2xl bg-surface-1 p-6 flex flex-col gap-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">5-4-3-2-1</h2>
          <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
            Back
          </button>
        </div>

        <AnimatePresence mode="wait">
          {allDone ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center gap-3 py-6"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "var(--surface-accent)" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground">Well done!</p>
              <p className="text-xs text-muted-foreground text-center">
                You are grounded in the present moment.
              </p>
            </motion.div>
          ) : (
            <motion.div key="steps" className="flex flex-col gap-3">
              {STEPS_54321.map((step) => {
                const isDone = completed.has(step.count);
                return (
                  <div
                    key={step.count}
                    className={`
                      flex items-center gap-3 p-3 rounded-xl border
                      ${isDone
                        ? "border-border bg-surface-2 opacity-60"
                        : "border-border bg-surface-2"}
                    `}
                  >
                    <div
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold
                        ${isDone ? "" : ""}
                      `}
                      style={{
                        backgroundColor: isDone ? "var(--surface-accent)" : "var(--surface-accent)",
                        color: isDone ? "var(--text-accent)" : "var(--text-accent)",
                      }}
                    >
                      {isDone ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        step.count
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {step.prompt}
                      </p>
                    </div>
                    {!isDone && (
                      <button
                        onClick={() => handleDone(step.count)}
                        className="text-xs px-3 py-1 rounded-full border border-border hover:border-border-strong transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        Done
                      </button>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {allDone && (
          <button
            onClick={() => {
              setCompleted(new Set());
            }}
            className="w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:border-border-strong transition-colors cursor-pointer"
          >
            Start over
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Box Breathing Exercise ────────────────────────────────────────────────────

function BoxBreathing({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState(-1); // -1 = not started
  const [timeLeft, setTimeLeft] = useState(0);
  const [cycleComplete, setCycleComplete] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  function startExercise() {
    setPhase(0);
    setTimeLeft(BOX_BREATHING_STEPS[0].duration);
    setCycleComplete(false);
    phaseRef.current = 0;
  }

  useEffect(() => {
    if (phase === -1) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          const nextPhase = phaseRef.current + 1;
          if (nextPhase >= BOX_BREATHING_STEPS.length) {
            clearTimer();
            setPhase(-1);
            setCycleComplete(true);
            return 0;
          }
          phaseRef.current = nextPhase;
          setPhase(nextPhase);
          return BOX_BREATHING_STEPS[nextPhase].duration;
        }
        return t - 1;
      });
    }, 1000);

    return clearTimer;
  }, [phase, clearTimer]);

  const currentStep = phase >= 0 ? BOX_BREATHING_STEPS[phase] : null;

  // Circle radius animation based on phase
  const circleScale = (() => {
    if (phase === -1 && !cycleComplete) return 0.5;
    if (cycleComplete) return 0.5;
    if (phase === 0) return 1; // Inhale - expand
    if (phase === 1) return 1; // Hold after inhale - stay expanded
    if (phase === 2) return 0.5; // Exhale - contract
    if (phase === 3) return 0.5; // Hold after exhale - stay contracted
    return 0.5;
  })();

  const displayTime = currentStep ? timeLeft : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-sm rounded-2xl bg-surface-1 p-6 flex flex-col gap-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Box Breathing</h2>
          <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
            Back
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* Breathing circle */}
          <div className="relative w-32 h-32 flex items-center justify-center">
            <motion.div
              className="w-24 h-24 rounded-full"
              style={{
                backgroundColor: "var(--surface-accent)",
                scale: circleScale,
              }}
              animate={{ scale: circleScale }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </div>

          {/* Phase label */}
          <AnimatePresence mode="wait">
            {phase >= 0 && currentStep && (
              <motion.p
                key={phase}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-sm font-medium text-foreground"
              >
                {currentStep.label}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Timer */}
          {phase >= 0 && (
            <span className="text-3xl font-semibold text-foreground tabular-nums">
              {displayTime}
            </span>
          )}

          {/* Cycle complete */}
          <AnimatePresence>
            {cycleComplete && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-1"
              >
                <p className="text-sm font-medium text-foreground">Well done!</p>
                <p className="text-xs text-muted-foreground">One cycle complete</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Not started */}
          {phase === -1 && !cycleComplete && (
            <p className="text-sm text-muted-foreground">Press Start to begin</p>
          )}
        </div>

        <div className="flex gap-2">
          {cycleComplete ? (
            <>
              <button
                onClick={() => setCycleComplete(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:border-border-strong transition-colors cursor-pointer"
              >
                Start over
              </button>
            </>
          ) : phase === -1 ? (
            <button
              onClick={startExercise}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
            >
              Start
            </button>
          ) : (
            <button
              onClick={() => {
                clearTimer();
                setPhase(-1);
                setTimeLeft(0);
              }}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:border-border-strong transition-colors cursor-pointer"
            >
              Stop
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Body Scan Exercise ─────────────────────────────────────────────────────────

function BodyScan({ onBack }: { onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-sm rounded-2xl bg-surface-1 p-6 flex flex-col gap-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Body Scan</h2>
          <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
            Back
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground leading-relaxed">
            Slowly scan your body from head to toe. Notice any areas of tension or discomfort without trying to change them.
          </p>
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <p>Start at the top of your head...</p>
            <p>Move down through your face, jaw, and neck.</p>
            <p>Notice your shoulders — are they tight?</p>
            <p>Scan your arms, hands, and fingers.</p>
            <p>Notice your chest, stomach, and back.</p>
            <p>Finally, your hips, legs, and feet.</p>
          </div>
          <p className="text-xs text-muted-foreground italic">
            There is nothing to fix. Simply notice.
          </p>
        </div>

        <button
          onClick={onBack}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
        >
          Done
        </button>
      </motion.div>
    </motion.div>
  );
}
