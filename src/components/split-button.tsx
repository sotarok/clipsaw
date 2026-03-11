"use client";

import { invoke } from "@/lib/tauri";
import { Scissors, Loader2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { SplitProgress } from "@/types";

interface SplitButtonProps {
  isRunning: boolean;
  progress: SplitProgress | null;
  outputDir: string | null;
  error: string | null;
  disabled: boolean;
  onSplit: () => void;
  onReset: () => void;
}

export function SplitButton({
  isRunning,
  progress,
  outputDir,
  error,
  disabled,
  onSplit,
  onReset,
}: SplitButtonProps) {
  const handleOpenFolder = async () => {
    if (!outputDir) return;
    try {
      await invoke("open_folder", { path: outputDir });
    } catch {
      // ignore
    }
  };

  if (outputDir) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-green-400">
          <FolderOpen className="h-4 w-4" />
          <span className="font-mono text-xs">{outputDir}</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleOpenFolder}>
          Open
        </Button>
        <Button variant="outline" size="sm" onClick={onReset}>
          OK
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-destructive">{error}</span>
        <Button variant="outline" size="sm" onClick={onReset}>
          閉じる
        </Button>
      </div>
    );
  }

  if (isRunning && progress) {
    const overallPercent =
      progress.total > 0
        ? ((progress.current - 1) / progress.total) * 100 +
          (progress.percent / progress.total)
        : 0;

    return (
      <div className="flex items-center gap-3 flex-1">
        <div className="flex-1 space-y-1">
          <Progress value={overallPercent} className="h-2" />
          <div className="text-xs text-muted-foreground">
            {progress.current}/{progress.total} — {progress.segment} ({progress.percent}%)
          </div>
        </div>
      </div>
    );
  }

  return (
    <Button onClick={onSplit} disabled={disabled || isRunning}>
      {isRunning ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Scissors className="h-4 w-4" />
      )}
      分割実行
    </Button>
  );
}
