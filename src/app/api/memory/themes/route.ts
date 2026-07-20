import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, getUser } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await getUser();
    const sb = await supabaseServer();

    const { data, error } = await sb
      .from("theme_trends")
      .select("*")
      .eq("user_id", userId)
      .order("conversation_count", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ themes: data ?? [] });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/memory/themes]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to fetch themes" }, { status: 500 });
  }
}
