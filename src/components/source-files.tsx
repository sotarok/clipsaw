"use client";

import { ChevronUp, ChevronDown, X, FileAudio, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/utils";
import type { SourceFile } from "@/types";

interface SourceFilesProps {
  files: SourceFile[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (id: string) => void;
  onAddClick: () => void;
}

export function SourceFiles({ files, onReorder, onRemove, onAddClick }: SourceFilesProps) {
  const totalDuration = files.reduce((sum, f) => sum + (f.duration || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">ソースファイル</label>
        <Button variant="outline" size="sm" onClick={onAddClick}>
          + 追加
        </Button>
      </div>

      {files.length === 0 ? (
        <div className="border border-dashed border-border rounded-md p-6 text-center text-sm text-muted-foreground">
          ファイルを追加してください
        </div>
      ) : (
        <div className="border border-border rounded-md divide-y divide-border">
          {files.map((file, index) => (
            <div
              key={file.id}
              className="flex items-center gap-2 px-3 py-2 group"
            >
              <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                {index + 1}.
              </span>
              {file.fileName.match(/\.(mp4|mov|webm)$/i) ? (
                <FileVideo className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <FileAudio className="h-4 w-4 text-primary shrink-0" />
              )}
              <span className="text-sm truncate flex-1">{file.fileName}</span>
              <span className="text-xs text-muted-foreground font-mono shrink-0">
                {file.duration ? formatTime(file.duration) : "--:--:--.-"}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={index === 0}
                  onClick={() => onReorder(index, index - 1)}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={index === files.length - 1}
                  onClick={() => onReorder(index, index + 1)}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => onRemove(file.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="text-right text-xs text-muted-foreground">
          合計: <span className="font-mono">{formatTime(totalDuration)}</span>
          {files.length > 1 && ` (${files.length} ファイル)`}
        </div>
      )}
    </div>
  );
}
