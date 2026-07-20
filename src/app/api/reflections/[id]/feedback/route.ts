import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const sb = await supabaseServer();
    const body = await req.json();
    const { was_helpful, was_edited, was_discarded } = body;

    const { data, error } = await sb
      .from("reflection_feedback")
      .update({ was_helpful, was_edited, was_discarded })
      .eq("reflection_id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[PATCH /api/reflections/:id/feedback]", err);
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
  }
}
