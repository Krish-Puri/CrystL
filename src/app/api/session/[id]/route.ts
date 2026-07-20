import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const sb = await supabaseServer();
    const body = await req.json();
    const { mood_at_start, theme } = body;

    const updates: Record<string, unknown> = {};
    if (mood_at_start !== undefined) updates.mood_at_start = mood_at_start;
    if (theme !== undefined) updates.theme = theme;

    const { data, error } = await sb
      .from("sessions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[PATCH /api/session/:id]", err);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const sb = await supabaseServer();

    // End the session
    await sb
      .from("sessions")
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq("id", id);

    // Delete conversation state
    await sb.from("conversation_states").delete().eq("session_id", id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/session/:id]", err);
    return NextResponse.json({ error: "Failed to end session" }, { status: 500 });
  }
}
