import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { path: folderPath } = body;

  if (!folderPath || typeof folderPath !== "string") {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  // Security: only allow paths under /media/output
  const resolved = path.resolve(folderPath);
  if (!resolved.startsWith("/media/output")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 403 });
  }

  try {
    exec(`open "${resolved}"`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to open folder" }, { status: 500 });
  }
}
