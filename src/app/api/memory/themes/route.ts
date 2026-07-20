import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const sb = await supabaseServer();
    const userId = req.nextUrl.searchParams.get("user_id");
    if (!userId) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

    const { data, error } = await sb
      .from("theme_trends")
      .select("*")
      .eq("user_id", userId)
      .order("conversation_count", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ themes: data ?? [] });
  } catch (err) {
    console.error("[GET /api/memory/themes]", err);
    return NextResponse.json({ error: "Failed to fetch themes" }, { status: 500 });
  }
}
