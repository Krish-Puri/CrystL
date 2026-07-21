"use client";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  message = "I couldn't finish that. Want to try again?",
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 14px",
        borderRadius: "8px",
        border: "1px solid var(--border)",
        backgroundColor: "transparent",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--text-muted)", flexShrink: 0 }}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>

      <span
        style={{
          fontSize: "13px",
          color: "var(--text-muted)",
          lineHeight: 1.4,
        }}
      >
        {message}
      </span>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontSize: "13px",
            color: "var(--text-muted)",
            textDecoration: "underline",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
