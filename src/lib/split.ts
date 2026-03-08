import { mkdirSync, existsSync } from "fs";
import path from "path";
import { db } from "./db";
import { projects, sourceFiles } from "./db/schema";
import { eq, asc } from "drizzle-orm";
import { splitMediaWithProgress } from "./ffmpeg";
import { getExtension } from "./utils";
import { EventEmitter } from "events";
import type { SplitProgress, SplitSegment } from "@/types";

const OUTPUT_DIR = "/media/output";

// Global event emitter for split progress
export const splitEvents = new EventEmitter();
splitEvents.setMaxListeners(50);

function sanitizeDirName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, "_");
}

export async function startSplit(
  projectId: string,
  segments: SplitSegment[],
  outputFormat: "copy" | "mp3",
  mp3Bitrate?: string,
): Promise<void> {
  const project = db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  if (!project) throw new Error("Project not found");

  // Determine input file
  let inputFile: string;
  if (project.concatFilePath) {
    inputFile = project.concatFilePath;
  } else {
    const sf = db
      .select()
      .from(sourceFiles)
      .where(eq(sourceFiles.projectId, projectId))
      .orderBy(asc(sourceFiles.sortOrder))
      .all();
    if (sf.length === 0) throw new Error("No source files");
    inputFile = path.join("/media/input", sf[0].filePath);
  }

  // Create output directory
  const dirName = sanitizeDirName(project.name) || new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const outputDir = path.join(OUTPUT_DIR, dirName);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const total = segments.length;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const sanitizedName = seg.name.replace(/[<>:"/\\|?*\0]/g, "_").replace(/\.\./g, "_");
    const inputExt = getExtension(inputFile);
    const outputExt = outputFormat === "mp3" ? "mp3" : inputExt;
    const outputFile = path.join(outputDir, `${sanitizedName}.${outputExt}`);

    // Verify output stays within outputDir
    if (!path.resolve(outputFile).startsWith(path.resolve(outputDir))) {
      throw new Error(`Invalid segment name: ${seg.name}`);
    }

    emitProgress(projectId, {
      current: i + 1,
      total,
      segment: seg.name,
      percent: 0,
    });

    try {
      await splitMediaWithProgress(
        inputFile,
        outputFile,
        seg.from,
        seg.to,
        outputFormat,
        mp3Bitrate,
        (percent) => {
          emitProgress(projectId, {
            current: i + 1,
            total,
            segment: seg.name,
            percent,
          });
        },
      );
    } catch (err) {
      emitProgress(projectId, {
        current: i + 1,
        total,
        segment: seg.name,
        percent: 0,
        status: "complete",
        outputDir: `Error: ${err instanceof Error ? err.message : "Unknown"}`,
      });
      return;
    }
  }

  emitProgress(projectId, {
    current: total,
    total,
    segment: segments[segments.length - 1].name,
    percent: 100,
    status: "complete",
    outputDir,
  });
}

function emitProgress(projectId: string, data: SplitProgress) {
  splitEvents.emit(`progress:${projectId}`, data);
  splitEvents.emit("progress", data);
}
