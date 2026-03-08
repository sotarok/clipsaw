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

  // Resolve with path traversal protection
  let fullPath: string | null = null;
  const directCandidate = path.resolve(MEDIA_ROOT, filePath);
  if (directCandidate.startsWith(MEDIA_ROOT + "/") && existsSync(directCandidate)) {
    fullPath = directCandidate;
  } else {
    const inputCandidate = path.resolve(MEDIA_ROOT, "input", filePath);
    if (inputCandidate.startsWith(MEDIA_ROOT + "/") && existsSync(inputCandidate)) {
      fullPath = inputCandidate;
    }
  }
  // Also try as absolute path (must be under /media/)
  if (!fullPath && filePath.startsWith("/")) {
    const resolved = path.resolve(filePath);
    if (resolved.startsWith(MEDIA_ROOT + "/") && existsSync(resolved)) {
      fullPath = resolved;
    }
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
