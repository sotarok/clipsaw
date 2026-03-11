"use client";

import { useState, useCallback } from "react";
import { invoke } from "@/lib/tauri";
import { ArrowLeft, Settings } from "lucide-react";
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
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { SettingsDialog, useNeedsSetup } from "@/components/settings-dialog";
import { DebugPanel } from "@/components/debug-panel";
import type { Project, ProjectDetail } from "@/types";

type Screen = "list" | "create" | "editor";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("list");
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [outputFormat, setOutputFormat] = useState<"copy" | "mp3">("copy");
  const [mp3Bitrate, setMp3Bitrate] = useState("192k");
  const [isGlobalMode, setIsGlobalMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { needsSetup, setNeedsSetup } = useNeedsSetup();

  const player = useMediaPlayer();
  const {
    timelines,
    addTimeline,
    updateTimeline,
    removeTimeline,
  } = useTimelines(project?.id ?? null, project?.timelines ?? []);
  const split = useSplit();

  const mediaPath = project
    ? (project.concatFilePath ?? project.sourceFiles[0]?.filePath ?? "")
    : "";

  const handleSelectProject = useCallback(async (p: Project) => {
    try {
      const detail: ProjectDetail = await invoke("get_project", { id: p.id });
      setProject(detail);
      setOutputFormat(
        (detail.settings?.outputFormat as "copy" | "mp3") || "copy"
      );
      setMp3Bitrate(detail.settings?.mp3Bitrate || "192k");
      setScreen("editor");
    } catch (err) {
      console.error("Failed to load project:", err);
    }
  }, []);

  const handleProjectCreated = useCallback((detail: ProjectDetail, options?: { globalMode?: boolean }) => {
    setProject(detail);
    setIsGlobalMode(options?.globalMode ?? false);
    setScreen("editor");
  }, []);

  const handleBack = () => {
    player.pause();
    setProject(null);
    setIsGlobalMode(false);
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
      outputFormat === "mp3" ? mp3Bitrate : undefined,
      isGlobalMode ? "default" : undefined
    );
  };

  // Show setup screen on first launch
  if (needsSetup === true) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="max-w-lg w-full space-y-6 text-center">
          <h1 className="text-2xl font-bold text-primary">Clipsaw</h1>
          <p className="text-muted-foreground">
            はじめに、入力ディレクトリと出力ディレクトリを設定してください。
          </p>
          <SettingsDialog
            open={true}
            onClose={() => {}}
            onSaved={() => setNeedsSetup(false)}
          />
        </div>
      </div>
    );
  }

  // Loading state
  if (needsSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">読み込み中...</div>
      </div>
    );
  }

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
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowSettings(true)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </header>

      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />

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
              onTogglePlay={player.togglePlay}
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
              onPlayRange={player.playRange}
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
      <KeyboardShortcutsHelp />
      <DebugPanel />
    </div>
  );
}
