"use client";

import { useRef, useEffect, useCallback } from "react";
import type { WaveformPeak, Timeline, SourceFile } from "@/types";

interface WaveformCanvasProps {
  peaks: WaveformPeak[];
  duration: number;
  currentTime: number;
  timelines?: Timeline[];
  sourceFiles?: SourceFile[];
  onSeek?: (time: number) => void;
  height?: number;
  className?: string;
}

export function WaveformCanvas({
  peaks,
  duration,
  currentTime,
  timelines = [],
  sourceFiles = [],
  onSeek,
  height = 120,
  className = "",
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0 || duration <= 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const centerY = h / 2;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw timeline overlays
    for (const tl of timelines) {
      const x1 = (tl.fromTime / duration) * w;
      const x2 = (tl.toTime / duration) * w;
      ctx.fillStyle = "rgba(6, 182, 212, 0.15)";
      ctx.fillRect(x1, 0, x2 - x1, h);
    }

    // Draw waveform
    const barWidth = w / peaks.length;
    ctx.fillStyle = "#a1a1aa";
    for (let i = 0; i < peaks.length; i++) {
      const peak = peaks[i];
      const x = i * barWidth;
      const minY = centerY + peak.min * centerY;
      const maxY = centerY + peak.max * centerY;
      ctx.fillRect(x, maxY, Math.max(barWidth - 0.5, 1), minY - maxY || 1);
    }

    // Draw file boundary markers
    if (sourceFiles.length > 1) {
      let accDuration = 0;
      for (let i = 0; i < sourceFiles.length - 1; i++) {
        accDuration += sourceFiles[i].duration || 0;
        const x = (accDuration / duration) * w;
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw playhead
    const playX = (currentTime / duration) * w;
    ctx.strokeStyle = "#06b6d4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, h);
    ctx.stroke();
  }, [peaks, duration, currentTime, timelines, sourceFiles]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || !canvasRef.current || duration <= 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    onSeek(Math.max(0, Math.min(time, duration)));
  };

  return (
    <div ref={containerRef} className={`w-full ${className}`} style={{ height }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        onClick={handleClick}
      />
    </div>
  );
}
