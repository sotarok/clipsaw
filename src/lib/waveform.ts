import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { generatePCM, probeMedia } from "./ffmpeg";
import type { WaveformResponse } from "@/types";

const CACHE_DIR = "/media/data/waveform-cache";

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCacheKey(filePath: string, width: number): string {
  const hash = createHash("md5").update(`${filePath}:${width}`).digest("hex");
  return hash;
}

export async function generateWaveform(
  filePath: string,
  width: number = 2000,
): Promise<WaveformResponse> {
  ensureCacheDir();

  const cacheKey = getCacheKey(filePath, width);
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);

  // Check cache
  if (existsSync(cachePath)) {
    const cached = JSON.parse(readFileSync(cachePath, "utf-8"));
    return cached as WaveformResponse;
  }

  // Probe for metadata
  const info = await probeMedia(filePath);

  // Generate raw PCM
  const pcmBuffer = await generatePCM(filePath);
  const pcmData = new Float32Array(
    pcmBuffer.buffer,
    pcmBuffer.byteOffset,
    pcmBuffer.byteLength / 4,
  );

  const totalSamples = pcmData.length;
  const samplesPerPixel = totalSamples / width;

  const peaks: Array<{ min: number; max: number }> = [];

  for (let i = 0; i < width; i++) {
    const start = Math.floor(i * samplesPerPixel);
    const end = Math.min(Math.floor((i + 1) * samplesPerPixel), totalSamples);

    if (start >= end) {
      peaks.push({ min: 0, max: 0 });
      continue;
    }

    let min = Infinity;
    let max = -Infinity;

    for (let j = start; j < end; j++) {
      const val = pcmData[j];
      if (val < min) min = val;
      if (val > max) max = val;
    }

    peaks.push({
      min: Math.round(min * 1000) / 1000,
      max: Math.round(max * 1000) / 1000,
    });
  }

  const result: WaveformResponse = {
    peaks,
    duration: info.duration,
    sampleRate: info.sampleRate || 44100,
    channels: info.channels || 2,
  };

  // Save cache
  writeFileSync(cachePath, JSON.stringify(result));

  return result;
}
