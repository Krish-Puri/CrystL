"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Show error from URL params if present
  const urlParams = new URLSearchParams(window.location.search);
  const urlError = urlParams.get("error");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const sb = createClient();
    const { error: signInError } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    setLoading(false);
    if (signInError) {
      setError(signInError.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--background)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: "600",
            marginBottom: "0.5rem",
            color: "var(--foreground)",
          }}
        >
          Sign in to CrystL
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--muted-foreground)",
            marginBottom: "2rem",
          }}
        >
          Enter your email and we'll send you a magic link.
        </p>

        {urlError && (
          <div
            style={{
              padding: "0.75rem 1rem",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "0.5rem",
              color: "#ef4444",
              fontSize: "0.875rem",
              marginBottom: "1rem",
            }}
          >
            The sign-in link expired or was already used. Request a new one below.
          </div>
        )}

        {sent ? (
          <div>
            <p style={{ color: "var(--foreground)", marginBottom: "0.5rem" }}>
              Check your inbox at
            </p>
            <p
              style={{
                fontWeight: "600",
                color: "var(--foreground)",
                marginBottom: "1.5rem",
              }}
            >
              {email}
            </p>
            <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
              Click the link in the email to sign in. It expires in 1 hour.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: "100%",
                padding: "0.625rem 0.875rem",
                backgroundColor: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                color: "var(--foreground)",
                fontSize: "0.875rem",
                outline: "none",
                marginBottom: "0.75rem",
                boxSizing: "border-box",
              }}
            />
            {error && (
              <p
                style={{
                  color: "#ef4444",
                  fontSize: "0.75rem",
                  textAlign: "left",
                  marginBottom: "0.5rem",
                }}
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.625rem",
                backgroundColor: loading ? "var(--muted-foreground)" : "var(--foreground)",
                color: "var(--background)",
                border: "none",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: "500",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Sending..." : "Send magic link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
