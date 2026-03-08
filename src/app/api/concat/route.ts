import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { startConcat } from "@/lib/concat";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { projectId, files } = body as { projectId: string; files: string[] };

  if (!projectId || !files || files.length < 2) {
    return NextResponse.json(
      { error: "projectId and at least 2 files are required" },
      { status: 400 },
    );
  }

  const project = db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Start concat in background (don't await)
  startConcat(projectId, files);

  return NextResponse.json({
    status: "processing",
    projectId,
  });
}
