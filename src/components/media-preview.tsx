"use client";

import { useEffect, useState, useRef } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { WaveformCanvas } from "@/components/waveform-canvas";
import type { WaveformPeak, Timeline, SourceFile } from "@/types";

interface MediaPreviewProps {
  mediaType: "video" | "audio";
  mediaPath: string;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  timelines?: Timeline[];
  sourceFiles?: SourceFile[];
  onBindMedia: (el: HTMLVideoElement | HTMLAudioElement | null) => void;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (v: number) => void;
}

export function MediaPreview({
  mediaType,
  mediaPath,
  duration,
  currentTime,
  isPlaying,
  volume,
  timelines = [],
  sourceFiles = [],
  onBindMedia,
  onTogglePlay,
  onSeek,
  onVolumeChange,
}: MediaPreviewProps) {
  const [peaks, setPeaks] = useState<WaveformPeak[]>([]);
  const [muted, setMuted] = useState(false);
  const prevVolumeRef = useRef(volume);

  useEffect(() => {
    if (volume > 0) prevVolumeRef.current = volume;
  }, [volume]);

  // Fetch waveform data
  useEffect(() => {
    if (!mediaPath) return;
    fetch("/api/waveform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath: mediaPath, width: 2000 }),
    })
      .then((r) => r.json())
      .then((data) => setPeaks(data.peaks || []))
      .catch(() => setPeaks([]));
  }, [mediaPath]);

  const toggleMute = () => {
    if (muted) {
      onVolumeChange(prevVolumeRef.current || 1);
      setMuted(false);
    } else {
      onVolumeChange(0);
      setMuted(true);
    }
  };

  const mediaUrl = `/api/media/${mediaPath}`;

  return (
    <div className="space-y-2">
      {mediaType === "video" ? (
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <video
            ref={onBindMedia}
            src={mediaUrl}
            className="w-full h-full"
            playsInline
          />
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden bg-card border border-border">
          <WaveformCanvas
            peaks={peaks}
            duration={duration}
            currentTime={currentTime}
            timelines={timelines}
            sourceFiles={sourceFiles}
            onSeek={onSeek}
            height={200}
          />
        </div>
      )}

      {/* Audio element (hidden for audio-only) */}
      {mediaType === "audio" && (
        <audio ref={onBindMedia} src={mediaUrl} preload="metadata" />
      )}

      {/* Waveform for video (small, below video) */}
      {mediaType === "video" && peaks.length > 0 && (
        <div className="rounded-md overflow-hidden bg-card border border-border">
          <WaveformCanvas
            peaks={peaks}
            duration={duration}
            currentTime={currentTime}
            timelines={timelines}
            sourceFiles={sourceFiles}
            onSeek={onSeek}
            height={48}
          />
        </div>
      )}

      {/* Play controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onTogglePlay}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleMute}
        >
          {muted || volume === 0 ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>

        <Slider
          className="w-24"
          value={[muted ? 0 : volume]}
          max={1}
          step={0.05}
          onValueChange={([v]) => {
            onVolumeChange(v);
            if (v > 0) setMuted(false);
          }}
        />
      </div>
    </div>
  );
}
