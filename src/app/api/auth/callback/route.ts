import { NextRequest, NextResponse } from "next/server";
import { supabaseUser } from "@/lib/supabase/server";

/**
 * Magic link / OAuth callback handler.
 * Supabase redirects here after the user clicks the email link.
 * We exchange the token and store the session cookie.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const sb = await supabaseUser();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, req.url));
    }
  }

  // Auth failed — redirect to login page with error
  return NextResponse.redirect(new URL(`/login?error=auth_failed`, req.url));
}
