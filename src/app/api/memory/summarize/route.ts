import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateReflection, generateEpisodicSummary } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const sb = await supabaseServer();
    const { session_id } = await req.json();

    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    // Fetch all messages for this session
    const { data: messages } = await sb
      .from("messages")
      .select("role, content")
      .eq("session_id", session_id)
      .order("created_at", { ascending: true });

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages found" }, { status: 404 });
    }

    // Build conversation text for summarization
    const conversation = messages
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join("\n");

    // Generate episodic summary + reflection in parallel
    const [episodicSummary, reflectionData] = await Promise.all([
      generateEpisodicSummary(conversation),
      generateReflection(conversation),
    ]);

    // Update session with episodic memory
    await sb
      .from("sessions")
      .update({ memory_summary: episodicSummary, ended_at: new Date().toISOString() })
      .eq("id", session_id);

    // Return reflection card for user confirmation
    return NextResponse.json({
      episodic_summary: episodicSummary,
      reflection: reflectionData,
    });
  } catch (err) {
    console.error("[POST /api/memory/summarize]", err);
    return NextResponse.json({ error: "Summarization failed" }, { status: 500 });
  }
}
