"use client";

interface UserMessageProps {
  content: string;
}

export function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="border-t border-border-subtle py-4">
      <p className="text-xs text-muted-foreground mb-2 tracking-wide uppercase font-medium">
        You
      </p>
      <p className="text-base leading-relaxed">{content}</p>
    </div>
  );
}
