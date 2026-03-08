import { describe, it, expect } from "vitest";
import {
  formatTime,
  parseTime,
  getExtension,
  getMediaType,
  getMimeType,
  SUPPORTED_EXTENSIONS,
} from "../utils";

describe("formatTime", () => {
  it("0秒を 00:00:00.0 にフォーマットする", () => {
    expect(formatTime(0)).toBe("00:00:00.0");
  });

  it("秒のみの値を正しくフォーマットする", () => {
    expect(formatTime(30)).toBe("00:00:30.0");
    expect(formatTime(59.5)).toBe("00:00:59.5");
  });

  it("分を含む値を正しくフォーマットする", () => {
    expect(formatTime(90)).toBe("00:01:30.0");
    expect(formatTime(600)).toBe("00:10:00.0");
  });

  it("時間を含む値を正しくフォーマットする", () => {
    expect(formatTime(3661.5)).toBe("01:01:01.5");
    expect(formatTime(7200)).toBe("02:00:00.0");
  });

  it("小数点以下を1桁で表示する", () => {
    expect(formatTime(1.3)).toBe("00:00:01.3");
    expect(formatTime(10.7)).toBe("00:00:10.7");
  });

  it("負の値は 00:00:00.0 を返す", () => {
    expect(formatTime(-1)).toBe("00:00:00.0");
    expect(formatTime(-100)).toBe("00:00:00.0");
  });

  it("Infinity は 00:00:00.0 を返す", () => {
    expect(formatTime(Infinity)).toBe("00:00:00.0");
    expect(formatTime(-Infinity)).toBe("00:00:00.0");
  });

  it("NaN は 00:00:00.0 を返す", () => {
    expect(formatTime(NaN)).toBe("00:00:00.0");
  });
});

describe("parseTime", () => {
  it("HH:MM:SS 形式をパースする", () => {
    expect(parseTime("00:00:00")).toBe(0);
    expect(parseTime("01:00:00")).toBe(3600);
    expect(parseTime("00:01:30")).toBe(90);
  });

  it("HH:MM:SS.s 形式をパースする", () => {
    expect(parseTime("00:00:01.5")).toBe(1.5);
    expect(parseTime("01:01:01.5")).toBe(3661.5);
  });

  it("複数桁の小数をパースする", () => {
    expect(parseTime("00:00:01.123")).toBe(1.123);
  });

  it("2桁以上の時間をパースする", () => {
    expect(parseTime("100:00:00")).toBe(360000);
  });

  it("不正な形式は null を返す", () => {
    expect(parseTime("")).toBeNull();
    expect(parseTime("abc")).toBeNull();
    expect(parseTime("1:2:3")).toBeNull(); // 分・秒が1桁
    expect(parseTime("00:00")).toBeNull(); // 秒がない
    expect(parseTime("00:00:00:00")).toBeNull(); // フィールドが多い
  });
});

describe("getExtension", () => {
  it("ファイル名から拡張子を取得する", () => {
    expect(getExtension("song.mp3")).toBe("mp3");
    expect(getExtension("video.MP4")).toBe("mp4");
    expect(getExtension("file.name.wav")).toBe("wav");
  });

  it("拡張子がないファイル名は空文字を返す", () => {
    expect(getExtension("noext")).toBe("noext");
  });

  it("空文字列は空文字を返す", () => {
    expect(getExtension("")).toBe("");
  });
});

describe("getMediaType", () => {
  it("動画拡張子は video を返す", () => {
    expect(getMediaType("mp4")).toBe("video");
    expect(getMediaType("mov")).toBe("video");
    expect(getMediaType("webm")).toBe("video");
  });

  it("音声拡張子は audio を返す", () => {
    expect(getMediaType("mp3")).toBe("audio");
    expect(getMediaType("wav")).toBe("audio");
    expect(getMediaType("flac")).toBe("audio");
    expect(getMediaType("ogg")).toBe("audio");
    expect(getMediaType("m4a")).toBe("audio");
  });

  it("未知の拡張子は audio を返す", () => {
    expect(getMediaType("xyz")).toBe("audio");
  });
});

describe("getMimeType", () => {
  it("動画拡張子の MIME タイプを返す", () => {
    expect(getMimeType("mp4")).toBe("video/mp4");
    expect(getMimeType("mov")).toBe("video/quicktime");
    expect(getMimeType("webm")).toBe("video/webm");
  });

  it("音声拡張子の MIME タイプを返す", () => {
    expect(getMimeType("wav")).toBe("audio/wav");
    expect(getMimeType("mp3")).toBe("audio/mpeg");
    expect(getMimeType("ogg")).toBe("audio/ogg");
    expect(getMimeType("flac")).toBe("audio/flac");
    expect(getMimeType("m4a")).toBe("audio/mp4");
  });

  it("未知の拡張子は application/octet-stream を返す", () => {
    expect(getMimeType("xyz")).toBe("application/octet-stream");
    expect(getMimeType("")).toBe("application/octet-stream");
  });
});

describe("SUPPORTED_EXTENSIONS", () => {
  it("8つのサポート拡張子を含む", () => {
    expect(SUPPORTED_EXTENSIONS).toHaveLength(8);
  });

  it("主要な音声・動画形式を含む", () => {
    expect(SUPPORTED_EXTENSIONS).toContain("mp3");
    expect(SUPPORTED_EXTENSIONS).toContain("mp4");
    expect(SUPPORTED_EXTENSIONS).toContain("wav");
    expect(SUPPORTED_EXTENSIONS).toContain("flac");
  });
});
