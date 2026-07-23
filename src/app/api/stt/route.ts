import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    // Auth check
    try {
      await getUser();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ error: "Groq API key not configured" }, { status: 500 });
    }

    // Call Groq Whisper STT API
    console.info("[POST /api/stt] request received, model: whisper-large-v3-turbo");
    const groqFormData = new FormData();
    groqFormData.append("file", file, file.name || "audio.webm");
    groqFormData.append("model", "whisper-large-v3-turbo");
    groqFormData.append("response_format", "json");
    groqFormData.append(
      "prompt",
      "Clean transcription of a voice note. Omit silence, background noise, music, applause, or any metadata artifacts."
    );

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
      },
      body: groqFormData,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[POST /api/stt] Groq Whisper error: ${res.status}`, errText);
      return NextResponse.json(
        { error: "Transcription service error", detail: errText },
        { status: 500 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ text: data.text ?? "" });
  } catch (err) {
    console.error("[POST /api/stt]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "STT processing failed" }, { status: 500 });
  }
}
