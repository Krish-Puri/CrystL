"use client";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: "reflection" | "mood" | "theme";
}

const SparklineIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const TagIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);

const BookIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);

export default function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      textAlign: "center",
      gap: "8px",
    }}>
      {icon && (
        <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>
          {icon === "reflection" && <BookIcon />}
          {icon === "mood" && <SparklineIcon />}
          {icon === "theme" && <TagIcon />}
        </div>
      )}
      <p style={{
        margin: 0,
        fontSize: "14px",
        fontWeight: 500,
        color: "var(--text-secondary)",
      }}>
        {title}
      </p>
      {description && (
        <p style={{
          margin: 0,
          fontSize: "13px",
          color: "var(--text-muted)",
          maxWidth: "240px",
          lineHeight: 1.5,
        }}>
          {description}
        </p>
      )}
    </div>
  );
}
