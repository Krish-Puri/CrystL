"use client";

import { useState, useEffect } from "react";
import type { Reflection, ThemeTrendEntry } from "@/types";

/**
 * Fetches reflections and theme trends when the Reflect drawer opens.
 * Keeps the component thin — CrystLApp just renders the data.
 */
export function useReflectDrawerData(open: boolean) {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [themeTrends, setThemeTrends] = useState<ThemeTrendEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    async function load() {
      setLoading(true);
      const [reflRes, themesRes] = await Promise.all([
        fetch("/api/reflections"),
        fetch("/api/memory/themes"),
      ]);

      if (reflRes.ok) {
        const d = await reflRes.json();
        setReflections(d.reflections ?? []);
      }
      if (themesRes.ok) {
        const d = await themesRes.json();
        setThemeTrends(d.trends ?? []);
      }
      setLoading(false);
    }

    load();
  }, [open]);

  return { reflections, themeTrends, loading };
}
