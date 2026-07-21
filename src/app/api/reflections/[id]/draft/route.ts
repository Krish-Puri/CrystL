import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, getUser } from "@/lib/supabase/server";
import { generateReflection } from "@/lib/gemini";

// DELETE /api/reflections/[id]/draft
// Discards a reflection draft — user chose not to save it
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getUser();
    const sb = await supabaseServer();
    const { id: session_id } = await params;

    // Verify session ownership and get draft
    const { data: draft } = await sb
      .from("reflection_drafts")
      .select("id, session_id")
      .eq("session_id", session_id)
      .eq("user_id", userId)
      .single();

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    await sb.from("reflection_drafts").delete().eq("id", draft.id);

    // Log reflection_discarded
    await sb.from("session_events").insert({
      user_id: userId,
      session_id,
      event_type: "reflection_discarded",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(
      "[DELETE /api/reflections/[id]/draft]",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json({ error: "Failed to discard draft" }, { status: 500 });
  }
}

// POST /api/reflections/[id]/draft/regenerate
// Generates a new reflection draft, replacing the current one
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getUser();
    const sb = await supabaseServer();
    const { id: session_id } = await params;

    // Verify session ownership and get mood
    const { data: session } = await sb
      .from("sessions")
      .select("user_id, mood_at_start")
      .eq("id", session_id)
      .eq("user_id", userId)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Fetch conversation for regeneration
    const { data: messages } = await sb
      .from("messages")
      .select("role, content")
      .eq("session_id", session_id)
      .order("created_at", { ascending: true });

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages found" }, { status: 404 });
    }

    const conversation = messages
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join("\n");

    // Generate new draft
    const startTime = Date.now();
    const reflectionData = await generateReflection(conversation);
    const latency_ms = Date.now() - startTime;

    // Log ai_usage
    await sb.from("ai_usage").insert({
      user_id: userId,
      session_id,
      model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
      operation: "reflection",
      latency_ms,
      success: true,
    });

    // Replace existing draft with new one
    const { data: newDraft, error: upsertError } = await sb
      .from("reflection_drafts")
      .update({
        content: reflectionData.content,
        theme_slug: reflectionData.theme_slug,
        mood: (session.mood_at_start as string) ?? "okay",
        next_step: reflectionData.next_step,
        created_at: new Date().toISOString(),
      })
      .eq("session_id", session_id)
      .eq("user_id", userId)
      .select()
      .single();

    if (upsertError) throw upsertError;

    // Log reflection_regenerated
    await sb.from("session_events").insert({
      user_id: userId,
      session_id,
      event_type: "reflection_regenerated",
    });

    // Also mark was_regenerated on the feedback row if one exists
    // reflection_feedback links via reflection_id, not session_id directly
    const { data: reflectionRow } = await sb
      .from("reflections")
      .select("id")
      .eq("session_id", session_id)
      .single();

    if (reflectionRow) {
      await sb
        .from("reflection_feedback")
        .update({ was_regenerated: true })
        .eq("reflection_id", reflectionRow.id);
    }

    return NextResponse.json({
      draft: {
        id: newDraft.id,
        content: newDraft.content,
        theme_slug: newDraft.theme_slug,
        mood: newDraft.mood,
        next_step: newDraft.next_step,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(
      "[POST /api/reflections/[id]/draft/regenerate]",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json({ error: "Failed to regenerate draft" }, { status: 500 });
  }
}
