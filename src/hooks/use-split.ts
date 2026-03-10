"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { SplitProgress, SplitSegment } from "@/types";

export function useSplit() {
  const [progress, setProgress] = useState<SplitProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [outputDir, setOutputDir] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const startSplit = useCallback(async (
    projectId: string,
    segments: SplitSegment[],
    outputFormat: "copy" | "mp3",
    mp3Bitrate?: string,
    outputSubDir?: string
  ) => {
    setIsRunning(true);
    setProgress(null);
    setOutputDir(null);
    setError(null);

    try {
      const res = await fetch("/api/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, segments, outputFormat, mp3Bitrate, outputSubDir }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Split failed" }));
        throw new Error(data.error || "Split failed");
      }

      // Connect SSE for progress
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource(`/api/split-progress?projectId=${projectId}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data: SplitProgress = JSON.parse(event.data);
          setProgress(data);

          if (data.status === "complete") {
            setOutputDir(data.outputDir || null);
            setIsRunning(false);
            es.close();
            eventSourceRef.current = null;
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        setIsRunning(false);
        setError("Progress connection lost");
      };
    } catch (err) {
      setIsRunning(false);
      setError(err instanceof Error ? err.message : "Split failed");
    }
  }, []);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const reset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setProgress(null);
    setIsRunning(false);
    setOutputDir(null);
    setError(null);
  }, []);

  return {
    progress,
    isRunning,
    outputDir,
    error,
    startSplit,
    reset,
  };
}
