// === API Response Types ===

export interface FileEntry {
  path: string;
  name: string;
  size: number;
  extension: string;
  mediaType: "video" | "audio";
  modifiedAt: string;
}

export interface FilesResponse {
  files: FileEntry[];
}

export interface WaveformPeak {
  min: number;
  max: number;
}

export interface WaveformResponse {
  peaks: WaveformPeak[];
  duration: number;
  sampleRate: number;
  channels: number;
}

export interface SplitSegment {
  name: string;
  from: number;
  to: number;
}

export interface SplitRequest {
  projectId: string;
  segments: SplitSegment[];
  outputFormat: "copy" | "mp3";
  mp3Bitrate?: string;
  outputSubDir?: string;
}

export interface SplitProgress {
  current: number;
  total: number;
  segment: string;
  percent: number;
  status?: "complete";
  outputDir?: string;
}

export interface ConcatRequest {
  projectId: string;
  files: string[];
}

export interface ConcatProgress {
  projectId: string;
  percent: number;
  status: "processing" | "done" | "error";
  duration?: number;
  error?: string;
}

// === DB Model Types ===

export interface Project {
  id: string;
  name: string;
  concatFilePath: string | null;
  duration: number | null;
  mediaType: string | null;
  concatStatus: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface SourceFile {
  id: string;
  projectId: string;
  filePath: string;
  fileName: string;
  duration: number | null;
  sortOrder: number;
}

export interface Timeline {
  id: string;
  projectId: string;
  name: string;
  fromTime: number;
  toTime: number;
  sortOrder: number;
}

export interface ProjectSettings {
  projectId: string;
  outputFormat: string;
  mp3Bitrate: string | null;
}

export interface ProjectDetail extends Project {
  sourceFiles: SourceFile[];
  timelines: Timeline[];
  settings: ProjectSettings | null;
}

// === FFprobe Types ===

export interface MediaInfo {
  duration: number;
  mediaType: "video" | "audio";
  codecName: string;
  sampleRate?: number;
  channels?: number;
  width?: number;
  height?: number;
  bitRate?: number;
}
