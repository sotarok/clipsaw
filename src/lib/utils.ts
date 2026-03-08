import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format seconds to HH:MM:SS.s */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "00:00:00.0";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const hStr = h.toString().padStart(2, "0");
  const mStr = m.toString().padStart(2, "0");
  const sStr = s.toFixed(1).padStart(4, "0");
  return `${hStr}:${mStr}:${sStr}`;
}

/** Parse HH:MM:SS.s to seconds */
export function parseTime(timeStr: string): number | null {
  const match = timeStr.match(/^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (!match) return null;
  const [, h, m, s] = match;
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
}

/** Get file extension */
export function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

/** Determine media type from extension */
export function getMediaType(ext: string): "video" | "audio" {
  const videoExts = ["mp4", "mov", "webm"];
  return videoExts.includes(ext) ? "video" : "audio";
}

/** Get MIME type from extension */
export function getMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    wav: "audio/wav",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    flac: "audio/flac",
    m4a: "audio/mp4",
  };
  return mimeMap[ext] || "application/octet-stream";
}

/** Supported media extensions */
export const SUPPORTED_EXTENSIONS = [
  "wav", "mp3", "mp4", "mov", "webm", "ogg", "flac", "m4a",
];
