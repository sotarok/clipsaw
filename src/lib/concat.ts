import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import path from "path";
import { db } from "./db";
import { projects, sourceFiles } from "./db/schema";
import { eq, asc } from "drizzle-orm";
import { concatMedia, probeMedia } from "./ffmpeg";
import { getExtension } from "./utils";
import { EventEmitter } from "events";
import type { ConcatProgress } from "@/types";

const CONCAT_DIR = "/media/data/concat";

// Global event emitter for concat progress
export const concatEvents = new EventEmitter();
concatEvents.setMaxListeners(50);

function ensureConcatDir() {
  if (!existsSync(CONCAT_DIR)) {
    mkdirSync(CONCAT_DIR, { recursive: true });
  }
}

export async function startConcat(
  projectId: string,
  files: string[],
): Promise<void> {
  ensureConcatDir();

  // Update status to processing
  db.update(projects)
    .set({ concatStatus: "processing", updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .run();

  emitProgress(projectId, { projectId, percent: 0, status: "processing" });

  // Validate file names
  for (const f of files) {
    if (f.includes("..") || f.includes("\n") || f.includes("\r") || f.includes("\0")) {
      emitProgress(projectId, { projectId, percent: 0, status: "error", error: `Invalid file name: ${f}` });
      return;
    }
  }

  const ext = getExtension(files[0]);
  const outputPath = path.join(CONCAT_DIR, `${projectId}.${ext}`);
  const listPath = path.join(CONCAT_DIR, `${projectId}_list.txt`);

  try {
    // Generate concat list file (escape single quotes for FFmpeg)
    const listContent = files
      .map((f) => `file '/media/input/${f.replace(/'/g, "'\\''")}'`)
      .join("\n");
    writeFileSync(listPath, listContent);

    // Calculate total duration for progress
    const sfRows = db
      .select()
      .from(sourceFiles)
      .where(eq(sourceFiles.projectId, projectId))
      .orderBy(asc(sourceFiles.sortOrder))
      .all();

    const totalDuration = sfRows.reduce((sum, sf) => sum + (sf.duration || 0), 0);

    // Run concat
    await concatMedia(
      listPath,
      outputPath,
      (percent) => {
        emitProgress(projectId, { projectId, percent, status: "processing" });
      },
      totalDuration,
    );

    // Probe result for accurate duration
    const info = await probeMedia(outputPath);

    // Update project
    db.update(projects)
      .set({
        concatFilePath: outputPath,
        duration: info.duration,
        concatStatus: "done",
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .run();

    emitProgress(projectId, {
      projectId,
      percent: 100,
      status: "done",
      duration: info.duration,
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";

    db.update(projects)
      .set({ concatStatus: "error", updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .run();

    emitProgress(projectId, {
      projectId,
      percent: 0,
      status: "error",
      error: errorMsg,
    });
  } finally {
    try { unlinkSync(listPath); } catch { /* ignore */ }
  }
}

function emitProgress(projectId: string, data: ConcatProgress) {
  concatEvents.emit(`progress:${projectId}`, data);
  concatEvents.emit("progress", data);
}
