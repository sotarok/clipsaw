import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { projects, sourceFiles, projectSettings, timelines } from "@/lib/db/schema";
import { desc, eq, asc } from "drizzle-orm";
import { probeMedia } from "@/lib/ffmpeg";
import { getExtension, getMediaType } from "@/lib/utils";
import path from "path";

const INPUT_DIR = "/media/input";

export async function GET() {
  const allProjects = db
    .select()
    .from(projects)
    .orderBy(desc(projects.updatedAt))
    .all();

  // Attach sourceFiles count
  const result = allProjects.map((p) => {
    const files = db
      .select()
      .from(sourceFiles)
      .where(eq(sourceFiles.projectId, p.id))
      .orderBy(asc(sourceFiles.sortOrder))
      .all();
    return { ...p, sourceFiles: files };
  });

  return NextResponse.json({ projects: result });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, files } = body as { name: string; files: string[] };

  if (!name || !files || files.length === 0) {
    return NextResponse.json(
      { error: "name and files are required" },
      { status: 400 },
    );
  }

  const projectId = nanoid();
  const now = new Date();

  // Probe each file for duration and media info
  const fileInfos: Array<{
    filePath: string;
    fileName: string;
    duration: number;
    mediaType: "video" | "audio";
    codecName: string;
    sampleRate?: number;
    channels?: number;
    width?: number;
    height?: number;
  }> = [];

  for (const filePath of files) {
    const fullPath = path.join(INPUT_DIR, filePath);
    const info = await probeMedia(fullPath);
    fileInfos.push({
      filePath,
      fileName: path.basename(filePath),
      duration: info.duration,
      mediaType: info.mediaType,
      codecName: info.codecName,
      sampleRate: info.sampleRate,
      channels: info.channels,
      width: info.width,
      height: info.height,
    });
  }

  // Determine mediaType from first file
  const mediaType = fileInfos[0].mediaType;
  const isSingle = files.length === 1;
  const totalDuration = fileInfos.reduce((sum, f) => sum + f.duration, 0);

  // Create project
  db.insert(projects)
    .values({
      id: projectId,
      name,
      concatFilePath: null,
      duration: isSingle ? fileInfos[0].duration : totalDuration,
      mediaType,
      concatStatus: isSingle ? "done" : "pending",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Create source files
  for (let i = 0; i < fileInfos.length; i++) {
    const fi = fileInfos[i];
    db.insert(sourceFiles)
      .values({
        id: nanoid(),
        projectId,
        filePath: fi.filePath,
        fileName: fi.fileName,
        duration: fi.duration,
        sortOrder: i,
      })
      .run();
  }

  // Create default settings
  const ext = getExtension(files[0]);
  const defaultFormat = ["wav", "flac"].includes(ext) ? "copy" : "copy";
  db.insert(projectSettings)
    .values({
      projectId,
      outputFormat: defaultFormat,
      mp3Bitrate: "192k",
    })
    .run();

  // Fetch created project with relations
  const project = db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  const sFiles = db
    .select()
    .from(sourceFiles)
    .where(eq(sourceFiles.projectId, projectId))
    .orderBy(asc(sourceFiles.sortOrder))
    .all();

  const settings = db
    .select()
    .from(projectSettings)
    .where(eq(projectSettings.projectId, projectId))
    .get();

  return NextResponse.json({
    ...project,
    sourceFiles: sFiles,
    timelines: [],
    settings: settings || null,
  });
}
