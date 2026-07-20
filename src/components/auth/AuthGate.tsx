"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check initial session
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setSending(false);
    } else {
      setSent(true);
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm flex flex-col items-center gap-8">
          {/* Logo / wordmark */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">✦</span>
            </div>
            <h1 className="text-xl font-semibold text-foreground">CrystL</h1>
            <p className="text-sm text-muted-foreground text-center">
              A calm space to be heard
            </p>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-sm text-foreground font-medium">Check your email</p>
              <p className="text-xs text-muted-foreground">
                We sent a magic link to <span className="font-medium text-foreground">{email}</span>.
                Click it to sign in.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="w-full flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="
                    w-full px-4 py-3 rounded-xl border border-border
                    bg-surface-1 text-foreground text-sm
                    placeholder:text-muted-foreground
                    focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary
                    transition-colors
                  "
                />
              </div>

              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={sending}
                className="
                  w-full py-3 rounded-xl bg-primary text-primary-foreground
                  text-sm font-medium font-semibold
                  hover:opacity-90 transition-opacity
                  disabled:opacity-50 cursor-not-allowed
                "
              >
                {sending ? "Sending…" : "Continue with email"}
              </button>

              <p className="text-xs text-muted-foreground text-center">
                No password needed. We'll send you a magic link.
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
