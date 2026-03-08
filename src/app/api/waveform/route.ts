import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { existsSync } from "fs";
import { generateWaveform } from "@/lib/waveform";

const INPUT_DIR = "/media/input";
const DATA_DIR = "/media/data";

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

  // Try /media/input first, then /media/data (for concat files)
  let fullPath = path.join(INPUT_DIR, filePath);
  if (!existsSync(fullPath)) {
    // Try as absolute path within /media/data
    if (filePath.startsWith("/media/data/")) {
      fullPath = filePath;
    } else {
      fullPath = path.join(DATA_DIR, filePath);
    }
  }

  if (!existsSync(fullPath)) {
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
