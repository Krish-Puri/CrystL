import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, getUser } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ session_id: string }> }
) {
  const { session_id } = await params;
  try {
    const { userId } = await getUser();
    const sb = await supabaseServer();

    // Verify ownership via session
    const { data: session } = await sb
      .from("crystl_sessions")
      .select("user_id")
      .eq("id", session_id)
      .single();

    if (!session || session.user_id !== userId) {
      return NextResponse.json({ error: "State not found" }, { status: 404 });
    }

    const { data, error } = await sb
      .from("conversation_states")
      .select("*")
      .eq("session_id", session_id)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/state/:session_id]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "State not found" }, { status: 404 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ session_id: string }> }
) {
  const { session_id } = await params;
  try {
    const { userId } = await getUser();
    const sb = await supabaseServer();
    const body = await req.json();

    // Verify ownership
    const { data: session } = await sb
      .from("crystl_sessions")
      .select("user_id")
      .eq("id", session_id)
      .single();

    if (!session || session.user_id !== userId) {
      return NextResponse.json({ error: "State not found" }, { status: 404 });
    }

    const allowed = [
      "current_mood",
      "conversation_phase",
      "current_theme",
      "safety_level",
      "last_reflection_saved",
      "message_count",
      "grounding_recommended",
      "is_paused",
      "mode",
    ];

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    const { data, error } = await sb
      .from("conversation_states")
      .update(updates)
      .eq("session_id", session_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[PATCH /api/state/:session_id]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to update state" }, { status: 500 });
  }
}
