import { spawn, execFile } from "child_process";
import { promisify } from "util";
import type { MediaInfo } from "@/types";

const execFileAsync = promisify(execFile);

/** Get media info via FFprobe */
export async function probeMedia(filePath: string): Promise<MediaInfo> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);

  const data = JSON.parse(stdout);
  const format = data.format || {};
  const streams: Array<Record<string, unknown>> = data.streams || [];

  const videoStream = streams.find((s) => s.codec_type === "video");
  const audioStream = streams.find((s) => s.codec_type === "audio");
  const mediaType = videoStream ? "video" : "audio";
  const primaryStream = videoStream || audioStream;

  return {
    duration: parseFloat(format.duration || "0"),
    mediaType,
    codecName: String(primaryStream?.codec_name || "unknown"),
    sampleRate: audioStream ? parseInt(String(audioStream.sample_rate), 10) : undefined,
    channels: audioStream ? Number(audioStream.channels) : undefined,
    width: videoStream ? Number(videoStream.width) : undefined,
    height: videoStream ? Number(videoStream.height) : undefined,
    bitRate: format.bit_rate ? parseInt(format.bit_rate, 10) : undefined,
  };
}

/** Split media file from/to with optional format conversion */
export function splitMedia(
  input: string,
  output: string,
  from: number,
  to: number,
  format: "copy" | "mp3",
  bitrate?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i", input,
      "-ss", from.toString(),
      "-to", to.toString(),
    ];

    if (format === "mp3") {
      args.push("-codec:a", "libmp3lame", "-b:a", bitrate || "192k");
    } else {
      args.push("-c", "copy", "-avoid_negative_ts", "make_zero");
    }

    args.push("-progress", "pipe:2", output);

    const proc = spawn("ffmpeg", args);
    let stderr = "";

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg split exited with code ${code}: ${stderr.slice(-500)}`));
    });

    proc.on("error", reject);
  });
}

/** Split media with progress callback */
export function splitMediaWithProgress(
  input: string,
  output: string,
  from: number,
  to: number,
  format: "copy" | "mp3",
  bitrate: string | undefined,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const duration = to - from;
    const args = [
      "-y",
      "-i", input,
      "-ss", from.toString(),
      "-to", to.toString(),
    ];

    if (format === "mp3") {
      args.push("-codec:a", "libmp3lame", "-b:a", bitrate || "192k");
    } else {
      args.push("-c", "copy", "-avoid_negative_ts", "make_zero");
    }

    args.push("-progress", "pipe:2", output);

    const proc = spawn("ffmpeg", args);
    let stderr = "";

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;

      // Parse progress from -progress pipe:2
      const timeMatch = text.match(/out_time_ms=(\d+)/);
      if (timeMatch && duration > 0) {
        const outTimeSec = parseInt(timeMatch[1], 10) / 1_000_000;
        const pct = Math.min(100, Math.round((outTimeSec / duration) * 100));
        onProgress(pct);
      }
    });

    proc.on("close", (code) => {
      if (code === 0) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`ffmpeg split exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on("error", reject);
  });
}

/** Concat files using concat demuxer */
export function concatMedia(
  listFilePath: string,
  outputPath: string,
  onProgress?: (percent: number, totalDuration: number) => void,
  totalDuration?: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", listFilePath,
      "-c", "copy",
      "-progress", "pipe:2",
      outputPath,
    ];

    const proc = spawn("ffmpeg", args);
    let stderr = "";

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;

      if (onProgress && totalDuration && totalDuration > 0) {
        const timeMatch = text.match(/out_time_ms=(\d+)/);
        if (timeMatch) {
          const outTimeSec = parseInt(timeMatch[1], 10) / 1_000_000;
          const pct = Math.min(100, Math.round((outTimeSec / totalDuration) * 100));
          onProgress(pct, totalDuration);
        }
      }
    });

    proc.on("close", (code) => {
      if (code === 0) {
        if (onProgress && totalDuration) onProgress(100, totalDuration);
        resolve();
      } else {
        reject(new Error(`ffmpeg concat exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on("error", reject);
  });
}

/** Generate raw PCM data from media file for waveform */
export function generatePCM(filePath: string, targetSamples: number = 16000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Cap sample rate to limit memory usage (targetSamples * 4 bytes max)
    const sampleRate = Math.max(100, Math.min(8000, targetSamples));
    const args = [
      "-i", filePath,
      "-ac", "1",
      "-f", "f32le",
      "-ar", sampleRate.toString(),
      "pipe:1",
    ];

    const proc = spawn("ffmpeg", args, { stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = [];

    proc.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    proc.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg pcm exited with code ${code}`));
    });

    proc.on("error", reject);
  });
}
