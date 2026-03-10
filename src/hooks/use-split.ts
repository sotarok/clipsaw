"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SplitProgress, SplitSegment } from "@/types";

export function useSplit() {
  const [progress, setProgress] = useState<SplitProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [outputDir, setOutputDir] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

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
      // Clean up previous listener
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }

      // Listen for split progress events
      unlistenRef.current = await listen<SplitProgress>("split-progress", (event) => {
        const data = event.payload;
        setProgress(data);

        if (data.status === "complete") {
          setOutputDir(data.outputDir || null);
          setIsRunning(false);
          if (unlistenRef.current) {
            unlistenRef.current();
            unlistenRef.current = null;
          }
        }
      });

      // Start split via Tauri command
      await invoke("start_split", {
        projectId,
        segments,
        outputFormat,
        mp3Bitrate: mp3Bitrate || null,
        outputSubDir: outputSubDir || null,
      });
    } catch (err) {
      setIsRunning(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);

  const reset = useCallback(() => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
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
