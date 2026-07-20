import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, getUser } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { userId } = await getUser();
    const sb = await supabaseServer();
    const body = await req.json();
    const { was_helpful, was_edited, was_discarded } = body;

    // Ownership check: verify reflection belongs to the user
    const { data: reflection } = await sb
      .from("reflections")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!reflection || reflection.user_id !== userId) {
      return NextResponse.json({ error: "Reflection not found" }, { status: 404 });
    }

    const { data, error } = await sb
      .from("reflection_feedback")
      .update({ was_helpful, was_edited, was_discarded })
      .eq("reflection_id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[PATCH /api/reflections/:id/feedback]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
  }
}
