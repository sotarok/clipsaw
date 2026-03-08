"use client";

import { useState, useEffect } from "react";
import { Folder, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatTime } from "@/lib/utils";
import type { Project } from "@/types";

interface ProjectListProps {
  onSelect: (project: Project) => void;
  onNewProject: () => void;
}

export function ProjectList({ onSelect, onNewProject }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = () => {
    setLoading(true);
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(data.projects || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("このプロジェクトを削除しますか？")) return;
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">プロジェクト一覧</h2>
        <Button onClick={onNewProject}>+ 新規プロジェクト</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
          <p className="text-sm">プロジェクトがありません</p>
          <p className="text-xs mt-1">新規プロジェクトを作成して始めましょう</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-1">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors group"
                onClick={() => onSelect(project)}
              >
                <Folder className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{project.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {project.mediaType || "unknown"}
                    {project.duration ? ` / ${formatTime(project.duration)}` : ""}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  onClick={(e) => handleDelete(e, project.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
