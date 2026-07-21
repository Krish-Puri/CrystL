"use client";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

type PostHogInstance = {
  init: (key: string, options?: Record<string, unknown>) => void;
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (id: string, properties?: Record<string, unknown>) => void;
};

let posthog: PostHogInstance | null = null;

export function initPostHog() {
  if (typeof window === "undefined") return;
  if (!POSTHOG_KEY) return;

  // Dynamic import to avoid SSR issues
  import("posthog-js").then((ph) => {
    // posthog-js uses a default export
    const posthogModule = (ph as unknown as { default: PostHogInstance }).default;
    posthog = posthogModule;
    posthogModule.init(POSTHOG_KEY!, {
      api_host: POSTHOG_HOST,
      person_profiles: "identified_only", // only identify after auth
      capture_pageview: false, // we track pageviews manually if needed
      capture_pageleave: false,
    });
  });
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!posthog) return;
  // Strip any accidental PII before sending
  const safeProps = { ...properties };
  delete safeProps.email;
  delete safeProps.name;
  delete safeProps.transcript;
  delete safeProps.content;
  delete safeProps.message;
  posthog.capture(event, safeProps);
}

export function identifyUser(userId: string) {
  if (!posthog) return;
  posthog.identify(userId, {});
}
