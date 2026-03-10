"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { FileBrowser } from "@/components/file-browser";
import { SourceFiles } from "@/components/source-files";
import type { FileEntry, SourceFile, ConcatProgress, ProjectDetail, Project } from "@/types";

interface ProjectCreatorProps {
  onCreated: (project: ProjectDetail, options?: { globalMode?: boolean }) => void;
  onCancel: () => void;
}

export function ProjectCreator({ onCreated, onCancel }: ProjectCreatorProps) {
  const [name, setName] = useState("");
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [concatProgress, setConcatProgress] = useState<ConcatProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quickEditBrowserOpen, setQuickEditBrowserOpen] = useState(false);
  const [quickCreating, setQuickCreating] = useState(false);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, []);

  const handleFilesSelected = useCallback((selected: FileEntry[]) => {
    const newFiles: SourceFile[] = selected.map((f, i) => ({
      id: crypto.randomUUID().slice(0, 12),
      projectId: "",
      filePath: f.path,
      fileName: f.name,
      duration: null,
      sortOrder: files.length + i,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, [files.length]);

  const handleReorder = (fromIndex: number, toIndex: number) => {
    setFiles((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated.map((f, i) => ({ ...f, sortOrder: i }));
    });
  };

  const handleRemove = (id: string) => {
    setFiles((prev) =>
      prev.filter((f) => f.id !== id).map((f, i) => ({ ...f, sortOrder: i }))
    );
  };

  const handleQuickEdit = useCallback(async (selected: FileEntry[]) => {
    if (selected.length === 0) return;
    const file = selected[0];
    setQuickCreating(true);
    setError(null);

    try {
      const autoName = file.name.replace(/\.[^.]+$/, "");

      const project: Project = await invoke("create_project", {
        request: {
          name: autoName,
          files: [file.path],
        },
      });

      const detail: ProjectDetail = await invoke("get_project", { id: project.id });
      onCreated(detail, { globalMode: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setQuickCreating(false);
    }
  }, [onCreated]);

  const handleCreate = async () => {
    if (!name.trim() || files.length === 0) return;
    setCreating(true);
    setError(null);

    try {
      const project: Project = await invoke("create_project", {
        request: {
          name: name.trim(),
          files: files.map((f) => f.filePath),
        },
      });

      // If multiple files, start concat and listen for progress
      if (files.length > 1 && project.concatStatus === "pending") {
        await invoke("start_concat", {
          projectId: project.id,
          files: files.map((f) => f.filePath),
        });

        // Listen for concat progress
        await new Promise<void>((resolve, reject) => {
          listen<ConcatProgress>("concat-progress", (event) => {
            const data = event.payload;
            setConcatProgress(data);

            if (data.status === "done") {
              if (unlistenRef.current) {
                unlistenRef.current();
                unlistenRef.current = null;
              }
              resolve();
            } else if (data.status === "error") {
              if (unlistenRef.current) {
                unlistenRef.current();
                unlistenRef.current = null;
              }
              reject(new Error(data.error || "Concat failed"));
            }
          }).then((unlisten) => {
            unlistenRef.current = unlisten;
          });
        });
      }

      // Fetch full project detail
      const detail: ProjectDetail = await invoke("get_project", { id: project.id });
      onCreated(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">新規プロジェクト作成</h2>
        <Button variant="ghost" onClick={onCancel}>
          キャンセル
        </Button>
      </div>

      {/* Quick Edit */}
      <div className="rounded-lg border border-border p-4 space-y-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setQuickEditBrowserOpen(true)}
          disabled={quickCreating}
        >
          {quickCreating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              準備中...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              ファイルを直接編集
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          プロジェクトを自動作成してすぐに編集を開始
        </p>
      </div>

      <FileBrowser
        open={quickEditBrowserOpen}
        onOpenChange={setQuickEditBrowserOpen}
        onSelect={handleQuickEdit}
        singleSelect
      />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">または</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-name">プロジェクト名</Label>
        <Input
          id="project-name"
          placeholder="例: 2025-03-08 バンド練習"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={creating}
        />
      </div>

      <SourceFiles
        files={files}
        onReorder={handleReorder}
        onRemove={handleRemove}
        onAddClick={() => setFileBrowserOpen(true)}
      />

      <FileBrowser
        open={fileBrowserOpen}
        onOpenChange={setFileBrowserOpen}
        onSelect={handleFilesSelected}
        selectedPaths={files.map((f) => f.filePath)}
      />

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {concatProgress && concatProgress.status === "processing" && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">ファイルを結合中...</div>
          <Progress value={concatProgress.percent} />
          <div className="text-xs text-muted-foreground text-right">
            {concatProgress.percent}%
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleCreate}
          disabled={!name.trim() || files.length === 0 || creating}
        >
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              作成中...
            </>
          ) : (
            "プロジェクト作成"
          )}
        </Button>
      </div>
    </div>
  );
}
