import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { projects, sourceFiles, timelines, projectSettings } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { existsSync, unlinkSync } from "fs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const project = db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .get();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const sFiles = db
    .select()
    .from(sourceFiles)
    .where(eq(sourceFiles.projectId, id))
    .orderBy(asc(sourceFiles.sortOrder))
    .all();

  const tlines = db
    .select()
    .from(timelines)
    .where(eq(timelines.projectId, id))
    .orderBy(asc(timelines.sortOrder))
    .all();

  const settings = db
    .select()
    .from(projectSettings)
    .where(eq(projectSettings.projectId, id))
    .get();

  return NextResponse.json({
    ...project,
    sourceFiles: sFiles,
    timelines: tlines,
    settings: settings || null,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const project = db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .get();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Update timelines if provided
  if (body.timelines) {
    // Delete existing timelines
    db.delete(timelines).where(eq(timelines.projectId, id)).run();

    // Insert new timelines
    for (let i = 0; i < body.timelines.length; i++) {
      const t = body.timelines[i];
      db.insert(timelines)
        .values({
          id: t.id || nanoid(),
          projectId: id,
          name: t.name,
          fromTime: t.fromTime,
          toTime: t.toTime,
          sortOrder: i,
        })
        .run();
    }
  }

  // Update settings if provided
  if (body.settings) {
    const existing = db
      .select()
      .from(projectSettings)
      .where(eq(projectSettings.projectId, id))
      .get();

    if (existing) {
      db.update(projectSettings)
        .set({
          outputFormat: body.settings.outputFormat ?? existing.outputFormat,
          mp3Bitrate: body.settings.mp3Bitrate ?? existing.mp3Bitrate,
        })
        .where(eq(projectSettings.projectId, id))
        .run();
    } else {
      db.insert(projectSettings)
        .values({
          projectId: id,
          outputFormat: body.settings.outputFormat || "copy",
          mp3Bitrate: body.settings.mp3Bitrate || "192k",
        })
        .run();
    }
  }

  // Update project name if provided
  if (body.name) {
    db.update(projects)
      .set({ name: body.name, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .run();
  } else {
    db.update(projects)
      .set({ updatedAt: new Date() })
      .where(eq(projects.id, id))
      .run();
  }

  // Return updated project
  const updated = db.select().from(projects).where(eq(projects.id, id)).get();
  const sFiles = db
    .select()
    .from(sourceFiles)
    .where(eq(sourceFiles.projectId, id))
    .orderBy(asc(sourceFiles.sortOrder))
    .all();
  const tlines = db
    .select()
    .from(timelines)
    .where(eq(timelines.projectId, id))
    .orderBy(asc(timelines.sortOrder))
    .all();
  const settings = db
    .select()
    .from(projectSettings)
    .where(eq(projectSettings.projectId, id))
    .get();

  return NextResponse.json({
    ...updated,
    sourceFiles: sFiles,
    timelines: tlines,
    settings: settings || null,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const project = db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .get();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Delete concat file if exists
  if (project.concatFilePath && existsSync(project.concatFilePath)) {
    try { unlinkSync(project.concatFilePath); } catch { /* ignore */ }
  }

  // Cascade delete handles sourceFiles, timelines, projectSettings
  db.delete(projects).where(eq(projects.id, id)).run();

  return NextResponse.json({ success: true });
}
