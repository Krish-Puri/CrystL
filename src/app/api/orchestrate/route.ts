import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, getUser } from "@/lib/supabase/server";
import { containsSafetyKeyword } from "@/lib/safety";
import { runOrchestrator } from "@/lib/gemini";
import type { ConversationDecision } from "@/lib/schemas";

// POST /api/orchestrate
// Single Gemini call per message — returns ConversationDecision
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let user_id: string | undefined;

  try {
    // ── Auth: get authenticated user ─────────────────────────────────
    let authedUserId: string;
    try {
      ({ userId: authedUserId } = await getUser());
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sb = await supabaseServer();
    const body = await req.json();
    const { session_id, transcript, is_pause } = body;

    if (!transcript?.trim()) {
      return NextResponse.json({ error: "Empty transcript" }, { status: 400 });
    }

    // ── Demo bypass: return a contextually-aware mock response ──
    if (process.env.GEMINI_BYPASS === "true") {
      const { mode } = body ?? {};
      const text = (transcript ?? "").toLowerCase().trim();
      const wordCount = text.split(/\s+/).length;

      // Short messages get short, curious responses
      if (wordCount <= 3) {
        const brief = [
          "Hmm. Tell me more about that.",
          "That's interesting. What's it like for you right now?",
          "Mm. What comes up when you sit with that?",
        ];
        return NextResponse.json({
          role: "assistant",
          content: brief[Math.floor(Date.now() / 1000) % brief.length],
          phase: "explore",
          decision: { open_safety: false, show_reflection: false, open_grounding: false },
          persistence: { update_theme: null, update_mood: null, end_session: false },
        });
      }

      // Longer messages — respond to the emotional weight
      let response: string;
      let intent: ConversationDecision["ai"]["intent"] = "vent";
      let suggested_phase: ConversationDecision["ai"]["suggested_phase"] = "explore";
      let update_theme: string | null = null;
      let update_mood: ConversationDecision["persistence"]["update_mood"] = null;

      if (mode === "vent" || text.includes("tired") || text.includes("exhausted") || text.includes("burnout") || text.includes("overwhelmed")) {
        response = "You've been carrying a lot. That exhaustion is real — you don't have to justify it here.";
        update_theme = "burnout";
        update_mood = "overwhelmed";
        intent = "vent";
      } else if (mode === "reflection" || text.includes("think") || text.includes("wonder") || text.includes("should i")) {
        response = "That's worth sitting with. What does your gut say is the real issue underneath all of this?";
        intent = "reflection";
        suggested_phase = "clarify";
      } else if (text.includes("anxious") || text.includes("nervous") || text.includes("worried") || text.includes("presentation") || text.includes("interview")) {
        response = "That anxiety is trying to tell you something. What's the worst outcome you're actually bracing for?";
        update_theme = "presentation-anxiety";
        update_mood = "low";
        intent = "vent";
      } else if (text.includes("sad") || text.includes("down") || text.includes("lonely") || text.includes("miss") || text.includes("gone")) {
        response = "That loss is real, even if it's the kind people don't always see. What do you miss most?";
        update_theme = "loneliness";
        update_mood = "sad";
        intent = "vent";
      } else if (text.includes("family") || text.includes("mom") || text.includes("dad") || text.includes("brother") || text.includes("sister") || text.includes("parent")) {
        response = "Family stuff is complicated in ways that are hard to explain to anyone else. What part of it weighs on you most?";
        update_theme = "family";
        update_mood = "low";
        intent = "vent";
      } else if (text.includes("breakup") || text.includes("relationship") || text.includes("ex") || text.includes("dating") || text.includes("partner")) {
        response = "Relationships mess with your head in ways that linger. How long has this been on your mind?";
        update_theme = "relationship-stress";
        intent = "vent";
      } else if (text.includes("work") || text.includes("job") || text.includes("career") || text.includes("boss") || text.includes("promotion")) {
        response = "Work stuff sneaks into everything else. Is this about the work itself, or what it represents about you?";
        update_theme = "career-growth";
        intent = "vent";
      } else if (mode === "advice" || text.includes("help") || text.includes("advice") || text.includes("should")) {
        response = "One small thing you could try this week: pick the one thing that's been nagging you most and do the smallest possible step toward it today.";
        intent = "advice";
        suggested_phase = "support";
      } else {
        // Default warm, curious response — no platitudes
        const defaults = [
          "You've been thinking about this for a reason. What's the part you keep coming back to?",
          "That thing you mentioned — does it show up in other parts of your life too?",
          "I'm curious about what you just said. When you imagine things being different, what does that look like?",
        ];
        response = defaults[Math.floor(Date.now() / 1000) % defaults.length];
        intent = "vent";
        suggested_phase = "explore";
      }

      const mockDecision: ConversationDecision = {
        ai: { response, intent, suggested_phase },
        ui: { show_reflection: false, open_safety: false },
        persistence: { update_theme, update_mood, end_session: false },
        safety_level: 0,
      };

      return NextResponse.json({
        role: "assistant",
        content: mockDecision.ai.response,
        phase: mockDecision.ai.suggested_phase,
        decision: {
          open_safety: false,
          show_reflection: false,
          open_grounding: false,
        },
        persistence: {
          update_theme: mockDecision.persistence.update_theme,
          update_mood: mockDecision.persistence.update_mood,
          end_session: false,
        },
      });
    }

    // ── Auth: verify user owns the session ─────────────────────────────
    const { data: session } = await sb
      .from("crystl_sessions")
      .select("user_id, memory_summary, theme, personality_version")
      .eq("id", session_id)
      .eq("user_id", authedUserId)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    user_id = session.user_id ?? undefined;

    // ── Get conversation state ─────────────────────────────────────────
    const { data: state } = await sb
      .from("conversation_states")
      .select("*")
      .eq("session_id", session_id)
      .single();

    if (!state) {
      return NextResponse.json({ error: "Session state not found" }, { status: 404 });
    }

    // ── Fast keyword pre-screen (heuristic only — never authoritative) ─
    const keywordFlag = containsSafetyKeyword(transcript);

    // ── Run orchestrator (single call — returns ConversationDecision) ─
    const { data: themeTrends } = await sb
      .from("theme_trends")
      .select("theme, trend, conversation_count")
      .eq("user_id", user_id)
      .limit(5);

    const episodicMemory = session.memory_summary ?? null;
    const semanticMemory =
      themeTrends
        ?.map(
          (t: { theme: string; trend: string; conversation_count: number }) =>
            `• ${t.theme} (${t.conversation_count} conversations, ${t.trend})`
        )
        .join("\n") ?? null;

    let decision: ConversationDecision;

    if (keywordFlag) {
      // Keyword triggered — orchestrator will handle safety_level in its output
      decision = await runOrchestrator({
        message: transcript,
        mode: state.mode ?? "default",
        phase: state.conversation_phase ?? "explore",
        episodicMemory,
        semanticMemory,
        personalityVersion: session.personality_version ?? 1,
      });
    } else {
      // No keyword — run orchestrator directly
      decision = await runOrchestrator({
        message: transcript,
        mode: state.mode ?? "default",
        phase: state.conversation_phase ?? "explore",
        episodicMemory,
        semanticMemory,
        personalityVersion: session.personality_version ?? 1,
      });
    }

    const latency_ms = Date.now() - startTime;

    // ── Log ai_usage ─────────────────────────────────────────────────
    await sb.from("ai_usage").insert({
      user_id,
      session_id,
      model: process.env.LLM_PROVIDER === "groq" ? "openai/gpt-oss-20b" : (process.env.GEMINI_MODEL ?? "gemini-2.0-flash"),
      operation: "orchestrator",
      latency_ms,
      success: true,
    });

    // ── Safety level 2: bounded response + overlay ────────────────────
    if (decision.safety_level === 2) {
      await sb.from("safety_events").insert({
        user_id,
        session_id,
        safety_level: 2,
      });

      return NextResponse.json({
        role: "assistant",
        content:
          "I'm really glad you told me. You don't have to carry this by yourself. Let's slow things down together.",
        phase: state.conversation_phase,
        is_safety_trigger: true,
        decision: {
          open_safety: decision.ui.open_safety,
          show_reflection: false,
          open_grounding: false,
        },
      });
    }

    // ── Pause Together ─────────────────────────────────────────────────
    if (is_pause) {
      return NextResponse.json({
        role: "assistant",
        content: "Take your time. Whenever you're ready, I'm still here.",
        phase: state.conversation_phase,
        is_pause_acknowledged: true,
        decision: {
          open_safety: false,
          show_reflection: false,
          open_grounding: false,
        },
      });
    }

    // ── Update conversation state ──────────────────────────────────────
    const newMessageCount = (state.message_count ?? 0) + 1;
    let nextPhase = decision.ai.suggested_phase;

    // Safety level 1 → shift to support phase
    if (decision.safety_level === 1) {
      nextPhase = "support";
    }

    await sb
      .from("conversation_states")
      .update({
        current_intent: decision.ai.intent,
        conversation_phase: nextPhase,
        safety_level: decision.safety_level,
        message_count: newMessageCount,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", session_id);

    // ── Store message pair ────────────────────────────────────────────
    await sb.from("messages").insert({
      session_id,
      role: "user",
      content: transcript,
      intent: decision.ai.intent,
    });

    await sb.from("messages").insert({
      session_id,
      role: "assistant",
      content: decision.ai.response,
      intent: decision.ai.intent,
    });

    // ── Update theme if new theme detected ────────────────────────────
    if (
      decision.persistence.update_theme &&
      session.theme !== decision.persistence.update_theme
    ) {
      await sb
        .from("crystl_sessions")
        .update({ theme: decision.persistence.update_theme })
        .eq("id", session_id);
    }

    // ── Return ConversationDecision to frontend ────────────────────────
    return NextResponse.json({
      role: "assistant",
      content: decision.ai.response,
      phase: nextPhase,
      decision: {
        open_safety: decision.ui.open_safety,
        show_reflection: decision.ui.show_reflection,
        open_grounding: decision.ui.open_grounding ?? false,
      },
      persistence: {
        update_theme: decision.persistence.update_theme,
        update_mood: decision.persistence.update_mood,
        end_session: decision.persistence.end_session,
      },
    });
  } catch (err) {
    const latency_ms = Date.now() - startTime;

    // Log failure to ai_usage (no PII)
    try {
      const sb = await supabaseServer();
      await sb.from("ai_usage").insert({
        user_id,
        model: process.env.LLM_PROVIDER === "groq" ? "openai/gpt-oss-20b" : (process.env.GEMINI_MODEL ?? "gemini-2.0-flash"),
        operation: "orchestrator",
        latency_ms,
        success: false,
        error_message: err instanceof Error ? err.message : "unknown",
      });
    } catch {
      // don't let logging failure cascade
    }

    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/orchestrate] error:", msg);

    // 429 = Gemini rate limit — tell the frontend to retry with backoff
    if (msg.includes("429")) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many requests right now. Please wait a moment and try again." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Orchestrator failed" }, { status: 500 });
  }
}
