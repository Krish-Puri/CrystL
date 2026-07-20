import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, getUser } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await getUser();
    const sb = await supabaseServer();
    const theme = req.nextUrl.searchParams.get("theme");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20");
    const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0");

    let query = sb
      .from("reflections")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (theme) {
      query = query.eq("theme", theme);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ reflections: data });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/reflections]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to fetch reflections" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await getUser();
    const sb = await supabaseServer();
    const body = await req.json();
    const { session_id, content, theme_slug, mood, next_step } = body;

    // Insert confirmed reflection
    const { data: reflection, error } = await sb
      .from("reflections")
      .insert({
        session_id,
        content,
        theme: theme_slug,
        mood,
        next_step,
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Create reflection_feedback row
    const { data: feedback } = await sb
      .from("reflection_feedback")
      .insert({ reflection_id: reflection.id })
      .select()
      .single();

    void feedback;

    // Update or insert theme_trends
    const { data: existing } = await sb
      .from("theme_trends")
      .select("*")
      .eq("user_id", userId)
      .eq("theme", theme_slug)
      .single();

    if (existing) {
      await sb
        .from("theme_trends")
        .update({
          conversation_count: (existing.conversation_count ?? 0) + 1,
          last_mood: mood,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await sb.from("theme_trends").insert({
        user_id: userId,
        theme: theme_slug,
        conversation_count: 1,
        trend: "new",
        last_mood: mood,
      });
    }

    // Delete the draft — reflection is now finalized
    if (session_id) {
      await sb
        .from("reflection_drafts")
        .delete()
        .eq("session_id", session_id)
        .eq("user_id", userId);

      await sb
        .from("conversation_states")
        .update({ last_reflection_saved: true })
        .eq("session_id", session_id);
    }

    // Log reflection_saved event
    await sb.from("session_events").insert({
      user_id: userId,
      session_id,
      event_type: "reflection_saved",
      metadata: { theme: theme_slug, was_edited: content !== undefined },
    });

    return NextResponse.json({ reflection });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/reflections]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to save reflection" }, { status: 500 });
  }
}
