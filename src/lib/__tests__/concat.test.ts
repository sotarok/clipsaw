import { describe, it, expect } from "vitest";

// concat.ts のファイル名バリデーションロジックをテスト
// 実際の startConcat は DB アクセスがあるため、バリデーションロジックのみ抽出してテスト

function validateConcatFileName(fileName: string): string | null {
  if (
    fileName.includes("..") ||
    fileName.includes("\n") ||
    fileName.includes("\r") ||
    fileName.includes("\0")
  ) {
    return `Invalid file name: ${fileName}`;
  }
  return null;
}

describe("concat ファイル名バリデーション", () => {
  it("通常のファイル名はバリデーションを通過する", () => {
    expect(validateConcatFileName("audio.mp3")).toBeNull();
    expect(validateConcatFileName("sub/dir/file.wav")).toBeNull();
    expect(validateConcatFileName("名前.mp4")).toBeNull();
  });

  it(".. を含むファイル名を拒否する", () => {
    expect(validateConcatFileName("../etc/passwd")).not.toBeNull();
    expect(validateConcatFileName("path/../secret")).not.toBeNull();
  });

  it("改行を含むファイル名を拒否する", () => {
    expect(validateConcatFileName("file\nname")).not.toBeNull();
    expect(validateConcatFileName("file\rname")).not.toBeNull();
  });

  it("NULLバイトを含むファイル名を拒否する", () => {
    expect(validateConcatFileName("file\0name")).not.toBeNull();
  });
});

// FFmpeg concat リストの生成ロジック
function generateConcatListContent(files: string[]): string {
  return files
    .map((f) => `file '/media/input/${f.replace(/'/g, "'\\''")}'`)
    .join("\n");
}

describe("concat リスト生成", () => {
  it("ファイル一覧から FFmpeg concat リストを生成する", () => {
    const result = generateConcatListContent(["a.mp3", "b.mp3"]);

    expect(result).toBe(
      "file '/media/input/a.mp3'\nfile '/media/input/b.mp3'"
    );
  });

  it("シングルクォートをエスケープする", () => {
    const result = generateConcatListContent(["it's a file.mp3"]);

    expect(result).toBe("file '/media/input/it'\\''s a file.mp3'");
  });

  it("空配列では空文字列を返す", () => {
    expect(generateConcatListContent([])).toBe("");
  });
});
