import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const sb = await supabaseServer();
    const body = await req.json();
    const { user_id, mood_at_start, mode } = body;

    // Create session
    const { data: session, error } = await sb
      .from("sessions")
      .insert({ user_id, mood_at_start, is_active: true })
      .select()
      .single();

    if (error) throw error;

    // Create conversation state
    await sb.from("conversation_states").insert({
      session_id: session.id,
      current_mood: mood_at_start,
      conversation_phase: "checkin",
      mode: mode ?? "default",
      message_count: 0,
    });

    // Check if this is the user's first session
    const { count } = await sb
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user_id)
      .eq("is_active", true);

    return NextResponse.json({
      session_id: session.id,
      is_first_session: (count ?? 0) <= 1,
    });
  } catch (err) {
    console.error("[POST /api/session]", err);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const sb = await supabaseServer();
    const sessionId = req.nextUrl.searchParams.get("session_id");
    if (!sessionId) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

    const { data: session } = await sb
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    const { data: state } = await sb
      .from("conversation_states")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    return NextResponse.json({ session, state });
  } catch (err) {
    console.error("[GET /api/session]", err);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}
