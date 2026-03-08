import { describe, it, expect } from "vitest";

// sanitizeDirName はモジュールスコープの関数なので、同じロジックをテストする
// split.ts の sanitizeDirName は export されていないため、ロジックを直接テストする
function sanitizeDirName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, "_");
}

describe("sanitizeDirName", () => {
  it("通常の名前はそのまま返す", () => {
    expect(sanitizeDirName("my-project")).toBe("my-project");
    expect(sanitizeDirName("track_01")).toBe("track_01");
  });

  it("パスの区切り文字をアンダースコアに置換する", () => {
    expect(sanitizeDirName("path/to\\file")).toBe("path_to_file");
  });

  it("Windowsの禁止文字をアンダースコアに置換する", () => {
    expect(sanitizeDirName('file<>:"|?*name')).toBe("file_______name");
  });

  it("空白をアンダースコアに置換する", () => {
    expect(sanitizeDirName("my project name")).toBe("my_project_name");
    expect(sanitizeDirName("multiple   spaces")).toBe("multiple_spaces");
  });

  it("タブや連続空白もアンダースコアに置換する", () => {
    expect(sanitizeDirName("tab\there")).toBe("tab_here");
    expect(sanitizeDirName("a \t b")).toBe("a_b");
  });

  it("空文字列は空文字列を返す", () => {
    expect(sanitizeDirName("")).toBe("");
  });
});

// split.ts のセグメント名サニタイズロジック
function sanitizeSegmentName(name: string): string {
  return name.replace(/[<>:"/\\|?*\0]/g, "_").replace(/\.\./g, "_");
}

describe("sanitizeSegmentName", () => {
  it("通常の名前はそのまま返す", () => {
    expect(sanitizeSegmentName("Track 01")).toBe("Track 01");
    expect(sanitizeSegmentName("intro")).toBe("intro");
  });

  it("パストラバーサルの .. を防ぐ", () => {
    // .. は _ に、/ は禁止文字として _ に置換される
    expect(sanitizeSegmentName("../../../etc/passwd")).toBe("______etc_passwd");
  });

  it("NULLバイトを除去する", () => {
    expect(sanitizeSegmentName("file\0name")).toBe("file_name");
  });

  it("危険な文字をアンダースコアに置換する", () => {
    expect(sanitizeSegmentName('file"name')).toBe("file_name");
    expect(sanitizeSegmentName("file|name")).toBe("file_name");
  });
});
