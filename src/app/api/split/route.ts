import { NextRequest, NextResponse } from "next/server";
import { startSplit } from "@/lib/split";
import type { SplitRequest } from "@/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SplitRequest;
  const { projectId, segments, outputFormat, mp3Bitrate } = body;

  if (!projectId || !segments || segments.length === 0) {
    return NextResponse.json(
      { error: "projectId and segments are required" },
      { status: 400 },
    );
  }

  // Start split in background (don't await)
  startSplit(projectId, segments, outputFormat || "copy", mp3Bitrate);

  return NextResponse.json({
    status: "processing",
    projectId,
  });
}
