/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import {
  normalizeMood,
  extractMemorySummary,
  normalizePhase,
  normalizeReflectionDraft,
} from "../src/lib/contracts";

describe("normalizeMood", () => {
  it("accepts valid moods", () => {
    expect(normalizeMood("okay")).toBe("okay");
    expect(normalizeMood("sad")).toBe("sad");
    expect(normalizeMood("low")).toBe("low");
    expect(normalizeMood("calm")).toBe("calm");
    expect(normalizeMood("overwhelmed")).toBe("overwhelmed");
  });

  it("converts string 'null' to okay", () => {
    expect(normalizeMood("null" as any)).toBe("okay");
  });

  it("converts null to okay", () => {
    expect(normalizeMood(null as any)).toBe("okay");
  });

  it("converts undefined to okay", () => {
    expect(normalizeMood(undefined as any)).toBe("okay");
  });
});

describe("extractMemorySummary", () => {
  it("prefers memory key over episodic", () => {
    expect(
      extractMemorySummary({
        memory: { memory_summary: "was tired" },
        episodic: null,
      })
    ).toBe("was tired");
  });

  it("falls back to episodic when memory key absent", () => {
    expect(
      extractMemorySummary({
        episodic: { memory_summary: "was tired" },
      })
    ).toBe("was tired");
  });

  it("returns null when neither is present", () => {
    expect(extractMemorySummary({})).toBe(null);
    expect(extractMemorySummary({ episodic: null })).toBe(null);
    expect(extractMemorySummary({ memory: null })).toBe(null);
  });

  it("returns null for malformed data", () => {
    expect(extractMemorySummary(null)).toBe(null);
    expect(extractMemorySummary({ episodic: { notMemorySummary: "x" } })).toBe(null);
  });
});

describe("normalizePhase", () => {
  it("accepts valid phases", () => {
    expect(normalizePhase("checkin")).toBe("checkin");
    expect(normalizePhase("start")).toBe("start");
    expect(normalizePhase("explore")).toBe("explore");
    expect(normalizePhase("clarify")).toBe("clarify");
    expect(normalizePhase("support")).toBe("support");
    expect(normalizePhase("reflection")).toBe("reflection");
    expect(normalizePhase("close")).toBe("close");
  });

  it("defaults unknown phases to 'explore'", () => {
    expect(normalizePhase("unknown_phase")).toBe("explore");
    expect(normalizePhase("" as any)).toBe("explore");
    expect(normalizePhase(null as any)).toBe("explore");
  });
});

describe("normalizeReflectionDraft", () => {
  it("accepts full valid draft with all fields", () => {
    const d = normalizeReflectionDraft({
      content: "You felt overwhelmed about work.",
      theme_slug: "career-growth",
      mood: "low",
      next_step: "Take a 5-minute walk",
    });
    expect(d.content).toBe("You felt overwhelmed about work.");
    expect(d.mood).toBe("low");
    expect(d.theme_slug).toBe("career-growth");
    expect(d.next_step).toBe("Take a 5-minute walk");
  });

  it("fills safe defaults for missing fields", () => {
    const d = normalizeReflectionDraft({});
    expect(d.content).toBe("A meaningful conversation took place.");
    expect(d.mood).toBe("okay");
    expect(d.theme_slug).toBe("general");
    expect(d.next_step).toBe(null);
  });

  it("converts null mood to okay", () => {
    const d = normalizeReflectionDraft({
      content: "x",
      theme_slug: "x",
      mood: null,
      next_step: null,
    });
    expect(d.mood).toBe("okay");
  });

  it("converts string 'null' mood to okay", () => {
    const d = normalizeReflectionDraft({
      content: "x",
      theme_slug: "x",
      mood: "null",
      next_step: "null",
    });
    expect(d.mood).toBe("okay");
    expect(d.next_step).toBe(null);
  });
});
