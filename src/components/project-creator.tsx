"use client";

import { useState, useCallback } from "react";
import { Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { FileBrowser } from "@/components/file-browser";
import { SourceFiles } from "@/components/source-files";
import type { FileEntry, SourceFile, ConcatProgress, ProjectDetail } from "@/types";

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
      // Auto-generate project name from filename (without extension)
      const autoName = file.name.replace(/\.[^.]+$/, "");

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: autoName,
          files: [file.path],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create project" }));
        throw new Error(data.error || "Failed to create project");
      }

      const project = await res.json();
      const detailRes = await fetch(`/api/projects/${project.id}`);
      const detail: ProjectDetail = await detailRes.json();
      onCreated(detail, { globalMode: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setQuickCreating(false);
    }
  }, [onCreated]);

  const handleCreate = async () => {
    if (!name.trim() || files.length === 0) return;
    setCreating(true);
    setError(null);

    try {
      // Create project
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          files: files.map((f) => f.filePath),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create project" }));
        throw new Error(data.error || "Failed to create project");
      }

      const project = await res.json();

      // If multiple files, start concat and listen for progress
      if (files.length > 1 && project.concatStatus === "pending") {
        const concatRes = await fetch("/api/concat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            files: files.map((f) => f.filePath),
          }),
        });

        if (!concatRes.ok) {
          throw new Error("Failed to start concat");
        }

        // Listen for concat progress
        const es = new EventSource(`/api/concat-progress?projectId=${project.id}`);

        await new Promise<void>((resolve, reject) => {
          es.onmessage = (event) => {
            try {
              const data: ConcatProgress = JSON.parse(event.data);
              setConcatProgress(data);

              if (data.status === "done") {
                es.close();
                resolve();
              } else if (data.status === "error") {
                es.close();
                reject(new Error(data.error || "Concat failed"));
              }
            } catch {
              // ignore
            }
          };

          es.onerror = () => {
            es.close();
            reject(new Error("Concat progress connection lost"));
          };
        });
      }

      // Fetch full project detail
      const detailRes = await fetch(`/api/projects/${project.id}`);
      const detail: ProjectDetail = await detailRes.json();
      onCreated(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
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
