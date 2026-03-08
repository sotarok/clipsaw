"use client";

import { useRef, useCallback, useState } from "react";
import { formatTime } from "@/lib/utils";
import type { SourceFile } from "@/types";

interface SeekbarProps {
  currentTime: number;
  duration: number;
  sourceFiles?: SourceFile[];
  onSeek: (time: number) => void;
  onTogglePlay?: () => void;
}

export function Seekbar({ currentTime, duration, sourceFiles = [], onSeek, onTogglePlay }: SeekbarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const getTimeFromEvent = useCallback(
    (clientX: number) => {
      if (!barRef.current || duration <= 0) return 0;
      const rect = barRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      return (x / rect.width) * duration;
    },
    [duration]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    onSeek(getTimeFromEvent(e.clientX));

    const handleMouseMove = (e: MouseEvent) => {
      onSeek(getTimeFromEvent(e.clientX));
    };

    const handleMouseUp = () => {
      setDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " ") {
      e.preventDefault();
      onTogglePlay?.();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSeek(Math.max(0, currentTime - 5));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onSeek(Math.min(duration, currentTime + 5));
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // File boundary positions
  const fileBoundaries: { position: number; label: string }[] = [];
  if (sourceFiles.length > 1) {
    let accDuration = 0;
    for (let i = 0; i < sourceFiles.length; i++) {
      if (i > 0) {
        fileBoundaries.push({
          position: (accDuration / duration) * 100,
          label: sourceFiles[i].fileName,
        });
      }
      accDuration += sourceFiles[i].duration || 0;
    }
  }

  return (
    <div className="space-y-1">
      {/* Seekbar track */}
      <div
        ref={barRef}
        className="relative h-3 cursor-pointer group"
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
      >
        {/* Background track */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 rounded-full bg-secondary">
          {/* Progress fill */}
          <div
            className="absolute top-0 left-0 h-full rounded-full bg-primary transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-primary shadow-md transition-transform group-hover:scale-125"
          style={{ left: `${progress}%` }}
        />
      </div>

      {/* File boundary markers */}
      {fileBoundaries.length > 0 && (
        <div className="relative h-4">
          {fileBoundaries.map((b, i) => (
            <div
              key={i}
              className="absolute top-0 text-[10px] text-amber-500 -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${b.position}%` }}
            >
              <div className="w-px h-2 bg-amber-500 mx-auto" />
              <span className="block truncate max-w-[80px]">{b.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Time display */}
      <div className="flex justify-between text-xs text-muted-foreground font-mono">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
