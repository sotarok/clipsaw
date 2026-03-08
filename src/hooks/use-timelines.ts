"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { Timeline } from "@/types";

export function useTimelines(projectId: string | null, initialTimelines: Timeline[] = []) {
  const [timelines, setTimelines] = useState<Timeline[]>(initialTimelines);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectIdRef = useRef(projectId);
  const prevProjectIdRef = useRef(projectId);

  // Stabilize: only sync from initialTimelines when projectId actually changes
  useEffect(() => {
    projectIdRef.current = projectId;
    if (projectId !== prevProjectIdRef.current) {
      prevProjectIdRef.current = projectId;
      setTimelines(initialTimelines);
    }
  }, [projectId, initialTimelines]);

  const syncToDb = useCallback((updated: Timeline[]) => {
    if (!projectIdRef.current) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      try {
        await fetch(`/api/projects/${projectIdRef.current}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timelines: updated }),
        });
      } catch (err) {
        console.error("Failed to sync timelines:", err);
      }
    }, 800);
  }, []);

  const addTimeline = useCallback((name: string, fromTime: number = 0, toTime: number = 0) => {
    const id = crypto.randomUUID().slice(0, 12);
    const newTimeline: Timeline = {
      id,
      projectId: projectIdRef.current || "",
      name,
      fromTime,
      toTime,
      sortOrder: timelines.length,
    };
    const updated = [...timelines, newTimeline];
    setTimelines(updated);
    syncToDb(updated);
    return newTimeline;
  }, [timelines, syncToDb]);

  const updateTimeline = useCallback((id: string, changes: Partial<Timeline>) => {
    setTimelines((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, ...changes } : t));
      syncToDb(updated);
      return updated;
    });
  }, [syncToDb]);

  const removeTimeline = useCallback((id: string) => {
    setTimelines((prev) => {
      const updated = prev
        .filter((t) => t.id !== id)
        .map((t, i) => ({ ...t, sortOrder: i }));
      syncToDb(updated);
      return updated;
    });
  }, [syncToDb]);

  const reorderTimelines = useCallback((fromIndex: number, toIndex: number) => {
    setTimelines((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      const reordered = updated.map((t, i) => ({ ...t, sortOrder: i }));
      syncToDb(reordered);
      return reordered;
    });
  }, [syncToDb]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return {
    timelines,
    setTimelines,
    addTimeline,
    updateTimeline,
    removeTimeline,
    reorderTimelines,
  };
}
