"use client";

import { useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectList } from "@/components/project-list";
import { ProjectCreator } from "@/components/project-creator";
import { MediaPreview } from "@/components/media-preview";
import { Seekbar } from "@/components/seekbar";
import { TimelineEditor } from "@/components/timeline-editor";
import { OutputSettings } from "@/components/output-settings";
import { SplitButton } from "@/components/split-button";
import { useMediaPlayer } from "@/hooks/use-media-player";
import { useTimelines } from "@/hooks/use-timelines";
import { useSplit } from "@/hooks/use-split";
import type { Project, ProjectDetail, Timeline } from "@/types";

type Screen = "list" | "create" | "editor";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("list");
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [outputFormat, setOutputFormat] = useState<"copy" | "mp3">("copy");
  const [mp3Bitrate, setMp3Bitrate] = useState("192k");

  const player = useMediaPlayer();
  const {
    timelines,
    addTimeline,
    updateTimeline,
    removeTimeline,
  } = useTimelines(project?.id ?? null, project?.timelines ?? []);
  const split = useSplit();

  const mediaPath = project
    ? project.concatFilePath ?? project.sourceFiles[0]?.filePath ?? ""
    : "";

  const handleSelectProject = useCallback(async (p: Project) => {
    try {
      const res = await fetch(`/api/projects/${p.id}`);
      const detail: ProjectDetail = await res.json();
      setProject(detail);
      setOutputFormat(
        (detail.settings?.outputFormat as "copy" | "mp3") || "copy"
      );
      setMp3Bitrate(detail.settings?.mp3Bitrate || "192k");
      setScreen("editor");
    } catch {
      // ignore
    }
  }, []);

  const handleProjectCreated = useCallback((detail: ProjectDetail) => {
    setProject(detail);
    setScreen("editor");
  }, []);

  const handleBack = () => {
    setProject(null);
    setScreen("list");
    split.reset();
  };

  const handleAddTimeline = () => {
    const lastTo =
      timelines.length > 0 ? timelines[timelines.length - 1].toTime : 0;
    addTimeline(`${String(timelines.length + 1).padStart(2, "0")}-segment`, lastTo, lastTo);
  };

  const handleSetFrom = (id: string) => {
    updateTimeline(id, { fromTime: player.currentTime });
  };

  const handleSetTo = (id: string) => {
    updateTimeline(id, { toTime: player.currentTime });
  };

  const handleSplit = () => {
    if (!project || timelines.length === 0) return;
    split.startSplit(
      project.id,
      timelines.map((t) => ({ name: t.name, from: t.fromTime, to: t.toTime })),
      outputFormat,
      outputFormat === "mp3" ? mp3Bitrate : undefined
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        {screen === "editor" && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h1 className="text-lg font-semibold text-primary">Clipsaw</h1>
        {project && screen === "editor" && (
          <span className="text-sm text-muted-foreground truncate">{project.name}</span>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {screen === "list" && (
          <div className="max-w-2xl mx-auto p-6">
            <ProjectList
              onSelect={handleSelectProject}
              onNewProject={() => setScreen("create")}
            />
          </div>
        )}

        {screen === "create" && (
          <div className="max-w-2xl mx-auto p-6">
            <ProjectCreator
              onCreated={handleProjectCreated}
              onCancel={() => setScreen("list")}
            />
          </div>
        )}

        {screen === "editor" && project && (
          <div className="max-w-4xl mx-auto p-4 space-y-4">
            {/* Preview */}
            <MediaPreview
              mediaType={(project.mediaType as "video" | "audio") || "audio"}
              mediaPath={mediaPath}
              duration={player.duration}
              currentTime={player.currentTime}
              isPlaying={player.isPlaying}
              volume={player.volume}
              timelines={timelines}
              sourceFiles={project.sourceFiles}
              onBindMedia={player.bindMedia}
              onTogglePlay={player.togglePlay}
              onSeek={player.seek}
              onVolumeChange={player.changeVolume}
            />

            {/* Seekbar */}
            <Seekbar
              currentTime={player.currentTime}
              duration={player.duration}
              sourceFiles={project.sourceFiles}
              onSeek={player.seek}
            />

            {/* Timeline Editor */}
            <TimelineEditor
              timelines={timelines}
              duration={player.duration}
              currentTime={player.currentTime}
              onAdd={handleAddTimeline}
              onUpdate={updateTimeline}
              onRemove={removeTimeline}
              onSetFrom={handleSetFrom}
              onSetTo={handleSetTo}
            />

            {/* Footer: Output settings + Split */}
            <div className="border-t border-border pt-4 flex items-center justify-between gap-4">
              <OutputSettings
                outputFormat={outputFormat}
                mp3Bitrate={mp3Bitrate}
                mediaType={(project.mediaType as "video" | "audio") || null}
                onFormatChange={setOutputFormat}
                onBitrateChange={setMp3Bitrate}
              />
              <SplitButton
                isRunning={split.isRunning}
                progress={split.progress}
                outputDir={split.outputDir}
                error={split.error}
                disabled={timelines.length === 0}
                onSplit={handleSplit}
                onReset={split.reset}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
