import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, getUser } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await getUser();
    const sb = await supabaseServer();
    const body = await req.json();
    const { mood_at_start, mode } = body;

    // Create session — user_id comes from auth, not the request body
    const { data: session, error } = await sb
      .from("crystl_sessions")
      .insert({ user_id: userId, mood_at_start, is_active: true })
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

    // Check if this is the user's first session (count=1 after insert = first)
    const { count } = await sb
      .from("crystl_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_active", true);

    return NextResponse.json({
      session_id: session.id,
      is_first_session: (count ?? 0) === 1,
    });
  } catch (err) {
    console.error("[POST /api/session]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await getUser();
    const sb = await supabaseServer();
    const sessionId = req.nextUrl.searchParams.get("session_id");
    if (!sessionId) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

    const { data: session } = await sb
      .from("crystl_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single();

    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const { data: state } = await sb
      .from("conversation_states")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    return NextResponse.json({ session, state });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/session]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}
