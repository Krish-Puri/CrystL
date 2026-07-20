import { NextRequest, NextResponse } from "next/server";
import { supabaseUser } from "@/lib/supabase/server";

/**
 * Initiate magic link sign-in.
 * Body: { email: string }
 * Sends a magic link to the provided email.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const sb = await supabaseUser();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${req.nextUrl.origin}/api/auth/callback`,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Magic link sent" });
  } catch {
    return NextResponse.json({ error: "Sign-in failed" }, { status: 500 });
  }
}
