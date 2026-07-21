import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, getUser } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await getUser();
    const sb = await supabaseServer();

    // Get most recent session with memory_summary
    const { data } = await sb
      .from("crystl_sessions")
      .select("memory_summary, theme, mood_at_start, created_at")
      .eq("user_id", userId)
      .eq("is_active", false)
      .order("ended_at", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({ episodic: data ?? null });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/memory/recent]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ episodic: null });
  }
}
