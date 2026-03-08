import { NextResponse } from "next/server";
import { readdirSync, statSync } from "fs";
import path from "path";
import { SUPPORTED_EXTENSIONS, getExtension, getMediaType } from "@/lib/utils";
import type { FileEntry } from "@/types";

const INPUT_DIR = "/media/input";

function walkDir(dir: string, baseDir: string): FileEntry[] {
  const entries: FileEntry[] = [];

  let items: string[];
  try {
    items = readdirSync(dir);
  } catch {
    return entries;
  }

  for (const item of items) {
    const fullPath = path.join(dir, item);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      entries.push(...walkDir(fullPath, baseDir));
    } else {
      const ext = getExtension(item);
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        const relativePath = path.relative(baseDir, fullPath);
        entries.push({
          path: relativePath,
          name: item,
          size: stat.size,
          extension: ext,
          mediaType: getMediaType(ext),
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    }
  }

  return entries;
}

export async function GET() {
  const files = walkDir(INPUT_DIR, INPUT_DIR);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return NextResponse.json({ files });
}
