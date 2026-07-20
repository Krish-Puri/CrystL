import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, getUser } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { userId } = await getUser();
    const sb = await supabaseServer();
    const body = await req.json();
    const { mood_at_start, theme } = body;

    // Verify ownership
    const { data: existing } = await sb
      .from("sessions")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existing || existing.user_id !== userId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (mood_at_start !== undefined) updates.mood_at_start = mood_at_start;
    if (theme !== undefined) updates.theme = theme;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await sb
      .from("sessions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[PATCH /api/session/:id]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { userId } = await getUser();
    const sb = await supabaseServer();

    // Verify ownership
    const { data: existing } = await sb
      .from("sessions")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existing || existing.user_id !== userId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // End the session
    await sb
      .from("sessions")
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq("id", id);

    // Delete conversation state
    await sb.from("conversation_states").delete().eq("session_id", id);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[DELETE /api/session/:id]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to end session" }, { status: 500 });
  }
}
