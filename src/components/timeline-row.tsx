"use client";

import { useState } from "react";
import { X, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime, parseTime } from "@/lib/utils";
import type { Timeline } from "@/types";

interface TimelineRowProps {
  timeline: Timeline;
  index: number;
  duration: number;
  currentTime: number;
  onUpdate: (id: string, changes: Partial<Timeline>) => void;
  onRemove: (id: string) => void;
  onSetFrom: (id: string) => void;
  onSetTo: (id: string) => void;
}

export function TimelineRow({
  timeline,
  index,
  duration,
  currentTime,
  onUpdate,
  onRemove,
  onSetFrom,
  onSetTo,
}: TimelineRowProps) {
  const [editingFrom, setEditingFrom] = useState(false);
  const [editingTo, setEditingTo] = useState(false);
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");

  const handleFromSubmit = () => {
    const parsed = parseTime(fromInput);
    if (parsed !== null) {
      onUpdate(timeline.id, { fromTime: Math.max(0, Math.min(parsed, timeline.toTime)) });
    }
    setEditingFrom(false);
  };

  const handleToSubmit = () => {
    const parsed = parseTime(toInput);
    if (parsed !== null) {
      onUpdate(timeline.id, { toTime: Math.max(timeline.fromTime, Math.min(parsed, duration)) });
    }
    setEditingTo(false);
  };

  // Mini bar visualization
  const barLeft = duration > 0 ? (timeline.fromTime / duration) * 100 : 0;
  const barWidth = duration > 0 ? ((timeline.toTime - timeline.fromTime) / duration) * 100 : 0;

  return (
    <div className="px-3 py-2.5 space-y-2 group">
      {/* Row header */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
          {index + 1}.
        </span>
        <Input
          value={timeline.name}
          onChange={(e) => onUpdate(timeline.id, { name: e.target.value })}
          className="h-7 text-sm flex-1 bg-transparent border-transparent hover:border-border focus:border-input"
          placeholder="セグメント名"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
          onClick={() => onRemove(timeline.id)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Time controls */}
      <div className="flex items-center gap-2 pl-7">
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-6 px-0"
          onClick={() => onUpdate(timeline.id, { fromTime: 0 })}
          title="最初から"
        >
          <SkipBack className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[11px] px-2"
          onClick={() => onSetFrom(timeline.id)}
        >
          Set From
        </Button>

        {editingFrom ? (
          <Input
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            onBlur={handleFromSubmit}
            onKeyDown={(e) => e.key === "Enter" && handleFromSubmit()}
            className="h-6 w-24 text-xs font-mono"
            autoFocus
          />
        ) : (
          <button
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              setFromInput(formatTime(timeline.fromTime));
              setEditingFrom(true);
            }}
          >
            {formatTime(timeline.fromTime)}
          </button>
        )}

        <span className="text-xs text-muted-foreground">—</span>

        {editingTo ? (
          <Input
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            onBlur={handleToSubmit}
            onKeyDown={(e) => e.key === "Enter" && handleToSubmit()}
            className="h-6 w-24 text-xs font-mono"
            autoFocus
          />
        ) : (
          <button
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              setToInput(formatTime(timeline.toTime));
              setEditingTo(true);
            }}
          >
            {formatTime(timeline.toTime)}
          </button>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[11px] px-2"
          onClick={() => onSetTo(timeline.id)}
        >
          Set To
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-6 px-0"
          onClick={() => onUpdate(timeline.id, { toTime: duration })}
          title="最後まで"
        >
          <SkipForward className="h-3 w-3" />
        </Button>
      </div>

      {/* Mini bar */}
      <div className="ml-7 mr-7 h-2 rounded-full bg-secondary relative overflow-hidden">
        <div
          className="absolute top-0 h-full rounded-full bg-primary/60"
          style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}
