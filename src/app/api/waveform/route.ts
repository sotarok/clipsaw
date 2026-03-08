import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { existsSync } from "fs";
import { generateWaveform } from "@/lib/waveform";

const MEDIA_ROOT = "/media";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { filePath, width } = body as {
    filePath: string;
    width?: number;
  };

  if (!filePath) {
    return NextResponse.json(
      { error: "filePath is required" },
      { status: 400 },
    );
  }

  // Resolve: try /media/{filePath} first, then /media/input/{filePath}, then absolute
  let fullPath: string | null = null;
  const directCandidate = path.join(MEDIA_ROOT, filePath);
  if (directCandidate.startsWith(MEDIA_ROOT) && existsSync(directCandidate)) {
    fullPath = directCandidate;
  } else {
    const inputCandidate = path.join(MEDIA_ROOT, "input", filePath);
    if (inputCandidate.startsWith(MEDIA_ROOT) && existsSync(inputCandidate)) {
      fullPath = inputCandidate;
    }
  }
  // Also try as absolute path (e.g. /media/data/concat/xxx.wav from DB)
  if (!fullPath && filePath.startsWith("/media/") && existsSync(filePath)) {
    fullPath = filePath;
  }

  if (!fullPath) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const result = await generateWaveform(fullPath, width || 2000);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
