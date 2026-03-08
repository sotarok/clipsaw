import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChildProcess } from "child_process";
import { EventEmitter } from "events";

// child_process をモック
vi.mock("child_process", () => ({
  spawn: vi.fn(),
  execFile: vi.fn(),
}));

vi.mock("util", () => ({
  promisify: (fn: unknown) => fn,
}));

import { spawn, execFile } from "child_process";
import { probeMedia, splitMedia, generatePCM } from "../ffmpeg";

const mockedSpawn = vi.mocked(spawn);
const mockedExecFile = vi.mocked(execFile);

function createMockProcess(): ChildProcess {
  const proc = new EventEmitter() as ChildProcess;
  proc.stdout = new EventEmitter() as ChildProcess["stdout"];
  proc.stderr = new EventEmitter() as ChildProcess["stderr"];
  proc.stdin = new EventEmitter() as ChildProcess["stdin"];
  return proc;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("probeMedia", () => {
  it("FFprobe の結果から MediaInfo を生成する", async () => {
    const ffprobeOutput = JSON.stringify({
      format: { duration: "120.5", bit_rate: "128000" },
      streams: [
        { codec_type: "audio", codec_name: "mp3", sample_rate: "44100", channels: 2 },
      ],
    });

    mockedExecFile.mockResolvedValueOnce({ stdout: ffprobeOutput, stderr: "" } as never);

    const result = await probeMedia("/path/to/file.mp3");

    expect(result).toEqual({
      duration: 120.5,
      mediaType: "audio",
      codecName: "mp3",
      sampleRate: 44100,
      channels: 2,
      width: undefined,
      height: undefined,
      bitRate: 128000,
    });
  });

  it("動画ストリームがある場合は video タイプを返す", async () => {
    const ffprobeOutput = JSON.stringify({
      format: { duration: "60.0" },
      streams: [
        { codec_type: "video", codec_name: "h264", width: 1920, height: 1080 },
        { codec_type: "audio", codec_name: "aac", sample_rate: "48000", channels: 2 },
      ],
    });

    mockedExecFile.mockResolvedValueOnce({ stdout: ffprobeOutput, stderr: "" } as never);

    const result = await probeMedia("/path/to/video.mp4");

    expect(result.mediaType).toBe("video");
    expect(result.codecName).toBe("h264");
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.sampleRate).toBe(48000);
  });

  it("ストリームが空の場合はデフォルト値を返す", async () => {
    const ffprobeOutput = JSON.stringify({
      format: {},
      streams: [],
    });

    mockedExecFile.mockResolvedValueOnce({ stdout: ffprobeOutput, stderr: "" } as never);

    const result = await probeMedia("/path/to/file");

    expect(result).toEqual({
      duration: 0,
      mediaType: "audio",
      codecName: "unknown",
      sampleRate: undefined,
      channels: undefined,
      width: undefined,
      height: undefined,
      bitRate: undefined,
    });
  });
});

describe("splitMedia", () => {
  it("copy フォーマットで正しい ffmpeg 引数を生成する", async () => {
    const mockProc = createMockProcess();
    mockedSpawn.mockReturnValueOnce(mockProc as never);

    const promise = splitMedia("/input.mp4", "/output.mp4", 10, 30, "copy");

    // ffmpeg が正常終了をシミュレート
    mockProc.emit("close", 0);

    await promise;

    expect(mockedSpawn).toHaveBeenCalledWith("ffmpeg", [
      "-y",
      "-i", "/input.mp4",
      "-ss", "10",
      "-to", "30",
      "-c", "copy",
      "-avoid_negative_ts", "make_zero",
      "-progress", "pipe:2",
      "/output.mp4",
    ]);
  });

  it("mp3 フォーマットで正しい ffmpeg 引数を生成する", async () => {
    const mockProc = createMockProcess();
    mockedSpawn.mockReturnValueOnce(mockProc as never);

    const promise = splitMedia("/input.wav", "/output.mp3", 0, 60, "mp3", "320k");

    mockProc.emit("close", 0);

    await promise;

    expect(mockedSpawn).toHaveBeenCalledWith("ffmpeg", [
      "-y",
      "-i", "/input.wav",
      "-ss", "0",
      "-to", "60",
      "-codec:a", "libmp3lame",
      "-b:a", "320k",
      "-progress", "pipe:2",
      "/output.mp3",
    ]);
  });

  it("mp3 でビットレート未指定時は 192k がデフォルト", async () => {
    const mockProc = createMockProcess();
    mockedSpawn.mockReturnValueOnce(mockProc as never);

    const promise = splitMedia("/input.wav", "/output.mp3", 0, 60, "mp3");

    mockProc.emit("close", 0);

    await promise;

    const callArgs = mockedSpawn.mock.calls[0][1] as string[];
    expect(callArgs).toContain("-b:a");
    expect(callArgs[callArgs.indexOf("-b:a") + 1]).toBe("192k");
  });

  it("ffmpeg がエラーコードで終了すると reject する", async () => {
    const mockProc = createMockProcess();
    mockedSpawn.mockReturnValueOnce(mockProc as never);

    const promise = splitMedia("/input.mp4", "/output.mp4", 0, 10, "copy");

    mockProc.stderr!.emit("data", Buffer.from("some error output"));
    mockProc.emit("close", 1);

    await expect(promise).rejects.toThrow("ffmpeg split exited with code 1");
  });

  it("spawn エラーで reject する", async () => {
    const mockProc = createMockProcess();
    mockedSpawn.mockReturnValueOnce(mockProc as never);

    const promise = splitMedia("/input.mp4", "/output.mp4", 0, 10, "copy");

    mockProc.emit("error", new Error("ENOENT"));

    await expect(promise).rejects.toThrow("ENOENT");
  });
});

describe("generatePCM", () => {
  it("サンプルレートが 100〜8000 の範囲にクランプされる", async () => {
    const mockProc = createMockProcess();
    mockedSpawn.mockReturnValueOnce(mockProc as never);

    const promise = generatePCM("/input.wav", 50);

    mockProc.stdout!.emit("data", Buffer.alloc(0));
    mockProc.emit("close", 0);

    await promise;

    const callArgs = mockedSpawn.mock.calls[0][1] as string[];
    const arIndex = callArgs.indexOf("-ar");
    expect(parseInt(callArgs[arIndex + 1])).toBe(100); // min clamp
  });

  it("大きい targetSamples は 8000 にクランプされる", async () => {
    const mockProc = createMockProcess();
    mockedSpawn.mockReturnValueOnce(mockProc as never);

    const promise = generatePCM("/input.wav", 99999);

    mockProc.stdout!.emit("data", Buffer.alloc(0));
    mockProc.emit("close", 0);

    await promise;

    const callArgs = mockedSpawn.mock.calls[0][1] as string[];
    const arIndex = callArgs.indexOf("-ar");
    expect(parseInt(callArgs[arIndex + 1])).toBe(8000); // max clamp
  });

  it("PCM バッファを結合して返す", async () => {
    const mockProc = createMockProcess();
    mockedSpawn.mockReturnValueOnce(mockProc as never);

    const promise = generatePCM("/input.wav", 4000);

    const chunk1 = Buffer.from(new Float32Array([0.5, -0.3]).buffer);
    const chunk2 = Buffer.from(new Float32Array([0.8]).buffer);

    mockProc.stdout!.emit("data", chunk1);
    mockProc.stdout!.emit("data", chunk2);
    mockProc.emit("close", 0);

    const result = await promise;

    expect(result.byteLength).toBe(12); // 3 floats * 4 bytes
  });
});
