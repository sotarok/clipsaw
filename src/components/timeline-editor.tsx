"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimelineRow } from "@/components/timeline-row";
import type { Timeline } from "@/types";

interface TimelineEditorProps {
  timelines: Timeline[];
  duration: number;
  currentTime: number;
  onAdd: () => void;
  onUpdate: (id: string, changes: Partial<Timeline>) => void;
  onRemove: (id: string) => void;
  onSetFrom: (id: string) => void;
  onSetTo: (id: string) => void;
  onPlayRange: (from: number, to: number) => void;
}

export function TimelineEditor({
  timelines,
  duration,
  currentTime,
  onAdd,
  onUpdate,
  onRemove,
  onSetFrom,
  onSetTo,
  onPlayRange,
}: TimelineEditorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">タイムライン</h3>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          追加
        </Button>
      </div>

      {timelines.length === 0 ? (
        <div className="border border-dashed border-border rounded-md p-6 text-center text-sm text-muted-foreground">
          タイムラインを追加して分割区間を設定してください
        </div>
      ) : (
        <div className="border border-border rounded-md divide-y divide-border">
          {timelines.map((timeline, index) => (
            <TimelineRow
              key={timeline.id}
              timeline={timeline}
              index={index}
              duration={duration}
              currentTime={currentTime}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onSetFrom={onSetFrom}
              onSetTo={onSetTo}
              onPlayRange={onPlayRange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
