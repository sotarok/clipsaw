"use client";

import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileAudio, FileVideo, Folder, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { FileEntry } from "@/types";

interface FileBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (files: FileEntry[]) => void;
  selectedPaths?: string[];
  singleSelect?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function groupByDirectory(files: FileEntry[]): Map<string, FileEntry[]> {
  const groups = new Map<string, FileEntry[]>();
  for (const file of files) {
    const parts = file.path.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir)!.push(file);
  }
  return groups;
}

export function FileBrowser({ open, onOpenChange, onSelect, selectedPaths, singleSelect = false }: FileBrowserProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const stablePaths = useMemo(() => selectedPaths ?? [], [selectedPaths?.join(",")]);
  const [selected, setSelected] = useState<Set<string>>(new Set(stablePaths));

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    invoke<FileEntry[]>("list_files")
      .then((data) => setFiles(data || []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    setSelected(new Set(stablePaths));
  }, [stablePaths]);

  const toggleFile = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedFiles = files.filter((f) => selected.has(f.path));
    onSelect(selectedFiles);
    onOpenChange(false);
  };

  const grouped = groupByDirectory(files);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>ファイルを選択</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[50vh] rounded-md border border-border p-2">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              入力ディレクトリにファイルがありません
            </div>
          ) : (
            <div className="space-y-3">
              {Array.from(grouped.entries()).map(([dir, dirFiles]) => (
                <div key={dir}>
                  {dir && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1 px-1">
                      <Folder className="h-3.5 w-3.5" />
                      {dir}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {dirFiles.map((file) => (
                      singleSelect ? (
                        <button
                          key={file.path}
                          className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer w-full text-left"
                          onClick={() => {
                            onSelect([file]);
                            onOpenChange(false);
                          }}
                        >
                          {file.mediaType === "video" ? (
                            <FileVideo className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <FileAudio className="h-4 w-4 text-primary shrink-0" />
                          )}
                          <span className="text-sm truncate flex-1">{file.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatFileSize(file.size)}
                          </span>
                        </button>
                      ) : (
                        <label
                          key={file.path}
                          className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selected.has(file.path)}
                            onCheckedChange={() => toggleFile(file.path)}
                          />
                          {file.mediaType === "video" ? (
                            <FileVideo className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <FileAudio className="h-4 w-4 text-primary shrink-0" />
                          )}
                          <span className="text-sm truncate flex-1">{file.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatFileSize(file.size)}
                          </span>
                        </label>
                      )
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          {singleSelect ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
          ) : (
            <>
              <div className="text-sm text-muted-foreground mr-auto">
                {selected.size} 件選択中
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                キャンセル
              </Button>
              <Button onClick={handleConfirm} disabled={selected.size === 0}>
                選択
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
