import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Service-role client — bypasses RLS. Use only for operations that need
 * admin privileges (e.g. reading ai_usage, cross-user aggregates).
 * For user-scoped operations, use getUser() + supabaseUser() instead.
 */
export async function supabaseServer(): Promise<SupabaseClient> {
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Anon-key client for user-scoped operations in App Router.
 * Uses the cookie-based session set by Supabase Auth magic link.
 * All user-specific routes should use supabaseUser() instead of supabaseServer().
 */
export async function supabaseUser(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
    },
  });
}

/**
 * Verify the authenticated user from the request cookie.
 * Returns the user_id if valid, throws "Unauthorized" if not authenticated.
 */
export async function getUser(): Promise<{ userId: string }> {
  const sb = await supabaseUser();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return { userId: user.id };
}
