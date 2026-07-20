import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const sb = await supabaseServer();
    const userId = req.nextUrl.searchParams.get("user_id");
    if (!userId) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

    // Get most recent session with memory_summary
    const { data } = await sb
      .from("sessions")
      .select("memory_summary, theme, mood_at_start, created_at")
      .eq("user_id", userId)
      .eq("is_active", false)
      .order("ended_at", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({ episodic: data ?? null });
  } catch {
    return NextResponse.json({ episodic: null });
  }
}
