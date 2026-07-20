import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const sb = await supabaseServer();
    const userId = req.nextUrl.searchParams.get("user_id");
    const theme = req.nextUrl.searchParams.get("theme");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20");
    const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0");

    if (!userId) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

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
    console.error("[GET /api/reflections]", err);
    return NextResponse.json({ error: "Failed to fetch reflections" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = await supabaseServer();
    const body = await req.json();
    const { session_id, content, theme, mood, next_step, user_id } = body;

    const { data: reflection, error } = await sb
      .from("reflections")
      .insert({ session_id, content, theme, mood, next_step, user_id })
      .select()
      .single();

    if (error) throw error;

    // Create reflection_feedback row
    await sb.from("reflection_feedback").insert({
      reflection_id: reflection.id,
    });

    // Update or insert theme_trends
    const { data: existing } = await sb
      .from("theme_trends")
      .select("*")
      .eq("user_id", user_id)
      .eq("theme", theme)
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
        user_id,
        theme,
        conversation_count: 1,
        trend: "new",
        last_mood: mood,
      });
    }

    // Mark reflection as saved in conversation_state
    if (session_id) {
      await sb
        .from("conversation_states")
        .update({ last_reflection_saved: true })
        .eq("session_id", session_id);
    }

    return NextResponse.json({ reflection });
  } catch (err) {
    console.error("[POST /api/reflections]", err);
    return NextResponse.json({ error: "Failed to save reflection" }, { status: 500 });
  }
}
