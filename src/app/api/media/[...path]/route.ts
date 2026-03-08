import { NextRequest, NextResponse } from "next/server";
import { existsSync, statSync, createReadStream } from "fs";
import path from "path";
import { getMimeType, getExtension } from "@/lib/utils";

// Serve files from /media (input, data, etc.)
const MEDIA_ROOT = "/media";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: pathSegments } = await params;
  const relativePath = pathSegments.join("/");

  // Resolve: first try under /media directly, then under /media/input as fallback
  let filePath: string | null = null;
  const directCandidate = path.join(MEDIA_ROOT, relativePath);
  if (directCandidate.startsWith(MEDIA_ROOT) && existsSync(directCandidate)) {
    filePath = directCandidate;
  } else {
    // Fallback: treat as relative to /media/input (for source file paths like "band/practice.wav")
    const inputCandidate = path.join(MEDIA_ROOT, "input", relativePath);
    if (inputCandidate.startsWith(MEDIA_ROOT) && existsSync(inputCandidate)) {
      filePath = inputCandidate;
    }
  }

  if (!filePath) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const stat = statSync(filePath);
  const fileSize = stat.size;
  const ext = getExtension(filePath);
  const contentType = getMimeType(ext);

  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      return new NextResponse("Invalid range", { status: 416 });
    }

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      return new NextResponse("Range not satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const chunkSize = end - start + 1;
    const stream = createReadStream(filePath, { start, end });
    const readableStream = nodeStreamToWeb(stream);

    return new NextResponse(readableStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize.toString(),
        "Content-Type": contentType,
      },
    });
  }

  // Full file response
  const stream = createReadStream(filePath);
  const readableStream = nodeStreamToWeb(stream);

  return new NextResponse(readableStream, {
    status: 200,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": fileSize.toString(),
      "Content-Type": contentType,
    },
  });
}

function nodeStreamToWeb(nodeStream: ReturnType<typeof createReadStream>): ReadableStream {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: string | Buffer) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        controller.enqueue(new Uint8Array(buf));
      });
      nodeStream.on("end", () => {
        controller.close();
      });
      nodeStream.on("error", (err) => {
        controller.error(err);
      });
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}
