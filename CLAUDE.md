# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clipsaw — ローカル動画・音声ファイルの分割ツール。Docker上で動作し、FFmpegでメディア処理を行うNext.js 15 (App Router) アプリケーション。

## Commands

```bash
# 開発（Docker + hot reload / turbopack）
make dev

# プロダクションビルド・起動
make prod

# 停止・クリーンアップ
make stop
make clean

# テスト
npm test              # Vitest 一回実行
npm run test:watch    # Vitest ウォッチモード

# DB マイグレーション
npm run db:generate
npm run db:migrate
```

開発はDockerコンテナ内で行われる。`make dev` でコンテナが起動し、ソースはボリュームマウントされる。

## Architecture

### Tech Stack
- **Next.js 15** (App Router) + TypeScript + Tailwind CSS 4
- **SQLite** (better-sqlite3) + **Drizzle ORM**
- **FFmpeg** — child_process.spawn で直接呼び出し
- **shadcn/ui** — UIコンポーネント基盤
- **Vitest** — テストフレームワーク

### データフロー

```
ブラウザ ←SSE→ API Routes ← lib/split.ts, lib/concat.ts ← lib/ffmpeg.ts ← FFmpeg
                  ↕
            lib/db (SQLite + Drizzle)
```

- 分割・結合はバックグラウンド実行。進捗は **EventEmitter → SSE** でクライアントにストリーミング。
- Waveform データは `/media/data/waveform-cache/` にファイルキャッシュ。

### ディレクトリ構成（重要な部分）

- `src/lib/ffmpeg.ts` — FFmpeg/FFprobe のラッパー（probeMedia, splitMedia, concatMedia, generatePCM）
- `src/lib/split.ts` — 分割ワークフロー。EventEmitter で進捗通知
- `src/lib/concat.ts` — 結合ワークフロー。concat demuxer 使用
- `src/lib/waveform.ts` — PCM → ピーク配列生成 + キャッシュ
- `src/lib/db/` — Drizzle スキーマ定義 + シングルトン DB インスタンス（Proxy パターンで遅延初期化）
- `src/lib/utils.ts` — 時間フォーマット、拡張子判定、MIME タイプ等のユーティリティ
- `src/hooks/` — use-media-player（再生制御）、use-timelines（タイムライン CRUD + デバウンス同期）、use-split（SSE 進捗）
- `src/app/api/` — API ルート群
- `src/components/ui/` — shadcn/ui コンポーネント

### DB スキーマ（4テーブル）

`projects` → `sourceFiles`, `timelines`, `projectSettings`（全て projectId で関連、カスケード削除）

### メディアパス（Docker コンテナ内）

| パス | 用途 |
|---|---|
| `/media/input` | 入力ファイル（読み取り専用マウント） |
| `/media/output` | 分割出力先 |
| `/media/data` | SQLite DB + waveform キャッシュ + concat 中間ファイル |

### API ルート

- `GET/POST /api/projects` — 一覧・作成
- `GET/PUT/DELETE /api/projects/[id]` — 個別操作（PUT はタイムライン + 設定を一括更新）
- `POST /api/split` + `GET /api/split-progress` — 分割実行 + SSE 進捗
- `POST /api/concat` + `GET /api/concat-progress` — 結合実行 + SSE 進捗
- `GET /api/files` — 入力ディレクトリのファイル一覧
- `GET /api/media/[...path]` — メディアファイル配信（Range リクエスト対応）
- `POST /api/waveform` — 波形データ生成

## Key Patterns

- パスエイリアス: `@/*` → `./src/*`
- ダークテーマ固定（`dark` クラス）
- ファイル名サニタイズ: パストラバーサル防止のため `[<>:"/\\|?*\0]` を `_` に置換
- メディアルートのパス検証: resolved path が `/media/` 配下であることを確認
- DB は WAL モード + 外部キー有効
