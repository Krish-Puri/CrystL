import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, getUser } from "@/lib/supabase/server";
import { generateReflection, generateEpisodicSummary } from "@/lib/gemini";
import { normalizeMood } from "@/lib/contracts";

// POST /api/memory/summarize
// Ends the session: generates episodic summary, creates reflection_draft, logs session_end
export async function POST(req: NextRequest) {
  try {
    const { userId } = await getUser();
    const sb = await supabaseServer();
    const { session_id } = await req.json();

    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    // Verify ownership
    const { data: session } = await sb
      .from("crystl_sessions")
      .select("user_id, mood_at_start, current_mood:conversation_states!inner(current_mood)")
      .eq("id", session_id)
      .single();

    if (!session || session.user_id !== userId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Fetch all messages for this session
    const { data: messages } = await sb
      .from("messages")
      .select("role, content")
      .eq("session_id", session_id)
      .order("created_at", { ascending: true });

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages found" }, { status: 404 });
    }

    // Build conversation text for summarization
    const conversation = messages
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join("\n");

    // Generate episodic summary + reflection draft in parallel
    const [episodicResult, reflectionResult] = await Promise.all([
      generateEpisodicSummary(conversation),
      generateReflection(conversation),
    ]);

    // Update session with episodic memory and mark inactive
    await sb
      .from("crystl_sessions")
      .update({
        memory_summary: episodicResult.summary,
        ended_at: new Date().toISOString(),
        is_active: false,
      })
      .eq("id", session_id);

    // Create reflection_drafts row — AI owns the draft, user owns the final
    const { data: draft, error: draftError } = await sb
      .from("reflection_drafts")
      .insert({
        session_id,
        user_id: userId,
        content: reflectionResult.content,
        theme_slug: reflectionResult.theme_slug,
        mood: normalizeMood(
          (Array.isArray(session.current_mood)
            ? session.current_mood[0]?.current_mood
            : session.current_mood) ?? session.mood_at_start
        ),
        next_step: reflectionResult.next_step,
      })
      .select()
      .single();

    if (draftError) throw draftError;

    // Log ai_usage for reflection generation
    await sb.from("ai_usage").insert({
      user_id: userId,
      session_id,
      model: reflectionResult.model,
      operation: "reflection",
      latency_ms: reflectionResult.latency_ms,
      success: true,
    });

    // Log ai_usage for summary generation
    await sb.from("ai_usage").insert({
      user_id: userId,
      session_id,
      model: episodicResult.model,
      operation: "summary",
      latency_ms: episodicResult.latency_ms,
      success: true,
    });

    // Log session_end event
    await sb.from("session_events").insert({
      user_id: userId,
      session_id,
      event_type: "session_end",
      metadata: { message_count: messages.length },
    });

    return NextResponse.json({
      episodic_summary: episodicResult.summary,
      draft: {
        id: draft.id,
        content: draft.content,
        theme_slug: draft.theme_slug,
        mood: draft.mood,
        next_step: draft.next_step,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/memory/summarize]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Summarization failed" }, { status: 500 });
  }
}
