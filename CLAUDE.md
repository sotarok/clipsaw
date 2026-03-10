# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clipsaw — ローカル動画・音声ファイルの分割ツール。Tauri 2.x ネイティブデスクトップアプリ。FFmpeg sidecar + Rust バックエンド + Next.js (static export) フロントエンド。

## Commands

```bash
# Tauri 開発（ネイティブアプリ + hot reload）
make tauri-dev
# または: cargo tauri dev

# Tauri プロダクションビルド
make tauri-build
# または: cargo tauri build

# Docker 版（レガシー、引き続き利用可能）
make dev          # Docker + hot reload / turbopack
make prod         # プロダクションビルド・起動
make stop         # 停止
make clean        # クリーンアップ

# テスト
npm test              # Vitest 一回実行
npm run test:watch    # Vitest ウォッチモード
```

## Architecture

### Tech Stack
- **Tauri 2.x** — ネイティブデスクトップアプリフレームワーク
- **Rust** — バックエンド（DB、FFmpeg、コマンド処理）
- **Next.js 16** (App Router, static export) + TypeScript + Tailwind CSS 4
- **SQLite** (rusqlite, bundled) — Rust 側で管理
- **FFmpeg** — sidecar バイナリとして同梱
- **shadcn/ui** — UIコンポーネント基盤

### データフロー

```
WebView (React) ← Tauri IPC (invoke/listen) → Rust Backend (Commands)
                                                  ↓
                                            FFmpeg (sidecar binary)
                                                  ↓
                                            SQLite (rusqlite)
```

- 分割・結合はバックグラウンド実行。進捗は **Tauri Events** でフロントエンドにストリーミング。
- Waveform データは `appDataDir/waveform-cache/` にファイルキャッシュ。
- メディア再生は **Tauri asset protocol** (`convertFileSrc`) 経由。

### ディレクトリ構成（重要な部分）

#### Rust バックエンド (`src-tauri/src/`)
- `db.rs` — SQLite スキーマ + CRUD 操作（rusqlite）
- `ffmpeg.rs` — FFmpeg/FFprobe のラッパー（probe_media, split_media, concat_media, generate_pcm）
- `commands.rs` — Tauri コマンド群（全 API エンドポイントに対応）
- `lib.rs` — アプリ初期化 + プラグイン + コマンド登録
- `main.rs` — エントリーポイント

#### フロントエンド (`src/`)
- `src/lib/utils.ts` — 時間フォーマット等のユーティリティ
- `src/lib/tauri.ts` — Tauri IPC ヘルパー
- `src/hooks/` — use-media-player（再生制御）、use-timelines（タイムライン CRUD + デバウンス同期）、use-split（Tauri Events 進捗）
- `src/components/` — UI コンポーネント群
- `src/components/ui/` — shadcn/ui コンポーネント

### DB スキーマ（4テーブル）

`projects` → `source_files`, `timelines`, `project_settings`（全て project_id で関連、カスケード削除）

DB パス: `appDataDir/clipsaw.db`（Tauri のアプリデータディレクトリ）

### Tauri コマンド

| コマンド | 説明 |
|---|---|
| `list_projects` | プロジェクト一覧 |
| `create_project` | 新規作成（probe 含む） |
| `get_project` | 詳細取得 |
| `update_project` | タイムライン + 設定の一括更新 |
| `delete_project` | 削除（カスケード） |
| `list_files` | 入力ディレクトリのファイル一覧 |
| `start_split` | 分割実行（バックグラウンド） |
| `start_concat` | 結合実行（バックグラウンド） |
| `generate_waveform` | 波形データ生成 + キャッシュ |
| `open_folder` | OS のファイルマネージャーで開く |
| `get_app_dirs` | アプリディレクトリ設定取得 |
| `set_input_dir` / `set_output_dir` | 入出力ディレクトリ設定 |

### Tauri Events

| イベント | Payload |
|---|---|
| `split-progress` | `SplitProgress` |
| `concat-progress` | `ConcatProgress` |

### FFmpeg sidecar

- `src-tauri/bin/ffmpeg-{target_triple}` — FFmpeg バイナリ
- `src-tauri/bin/ffprobe-{target_triple}` — FFprobe バイナリ
- ビルド前にプラットフォーム対応の静的バイナリを配置する必要あり

## Key Patterns

- パスエイリアス: `@/*` → `./src/*`
- ダークテーマ固定（`dark` クラス）
- ファイル名サニタイズ: パストラバーサル防止のため `[<>:"/\\|?*\0]` を `_` に置換
- DB は WAL モード + 外部キー有効
- フロントエンドの fetch → `invoke()` / `listen()` (Tauri IPC)
- メディア URL → `convertFileSrc()` (Tauri asset protocol)
