import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { containsSafetyKeyword } from "@/lib/safety";
import { runOrchestrator } from "@/lib/gemini";
import type { ConversationDecision } from "@/lib/schemas";

// POST /api/orchestrate
// Single Gemini call per message — returns ConversationDecision
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let user_id: string | undefined;

  try {
    const sb = await supabaseServer();
    const body = await req.json();
    const { session_id, transcript, is_pause } = body;

    if (!transcript?.trim()) {
      return NextResponse.json({ error: "Empty transcript" }, { status: 400 });
    }

    // ── Auth: verify user owns the session ─────────────────────────────
    const { data: session } = await sb
      .from("sessions")
      .select("user_id, memory_summary, theme")
      .eq("id", session_id)
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
      });
    } else {
      // No keyword — run orchestrator directly
      decision = await runOrchestrator({
        message: transcript,
        mode: state.mode ?? "default",
        phase: state.conversation_phase ?? "explore",
        episodicMemory,
        semanticMemory,
      });
    }

    const latency_ms = Date.now() - startTime;

    // ── Log ai_usage ─────────────────────────────────────────────────
    await sb.from("ai_usage").insert({
      user_id,
      session_id,
      model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
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
          open_safety: true,
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
        .from("sessions")
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
        model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
        operation: "orchestrator",
        latency_ms,
        success: false,
        error_message: err instanceof Error ? err.message : "unknown",
      });
    } catch {
      // don't let logging failure cascade
    }

    console.error("[POST /api/orchestrate] error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Orchestrator failed" }, { status: 500 });
  }
}
