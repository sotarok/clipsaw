# Media Slicer - 詳細設計書

## 1. プロジェクト概要

ローカル環境で動作する動画・音声カッターWebアプリ。Docker上で稼働し、長時間の録音・録画ファイルを任意の区間で分割・書き出す。複数ファイルにまたがる録音・録画にも対応し、事前結合してから作業できる。

### 想定ユースケース

- バンド練習の2時間通し録音(wav) → 曲ごとにmp3で分割保存
- Podcast用の長時間動画(mp4) → 3パートに分割
- ゲームプレイ録画(mp4/mov) → 試合ごとに分割
- 録画ソフトが自動分割した複数ファイル → 結合してから曲/試合ごとに分割

---

## 2. 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Next.js 15 (App Router) + TypeScript |
| UI | shadcn/ui + Tailwind CSS (ダークテーマ) |
| 波形描画 | Canvas API (サーバー生成のピークデータを描画) |
| 動画再生 | HTML5 `<video>` タグ (Range Request対応配信) |
| メディア処理 | FFmpeg (ネイティブ、child_process経由) |
| DB | SQLite + Drizzle ORM |
| コンテナ | Docker (node:20-slim + ffmpeg) |

---

## 3. ディレクトリ構成

```
media-slicer/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # ルートレイアウト (ダークテーマ)
│   │   ├── page.tsx                # メインUI (SPA的に1画面)
│   │   ├── api/
│   │   │   ├── files/
│   │   │   │   └── route.ts        # GET: /media/input ファイル一覧
│   │   │   ├── media/
│   │   │   │   └── [...path]/
│   │   │   │       └── route.ts    # GET: Range Request対応ファイル配信
│   │   │   ├── concat/
│   │   │   │   └── route.ts        # POST: 複数ファイル結合
│   │   │   ├── concat-progress/
│   │   │   │   └── route.ts        # GET: SSE 結合進捗
│   │   │   ├── waveform/
│   │   │   │   └── route.ts        # POST: 波形ピークデータ生成
│   │   │   ├── split/
│   │   │   │   └── route.ts        # POST: 分割実行
│   │   │   ├── split-progress/
│   │   │   │   └── route.ts        # GET: SSE 分割進捗
│   │   │   └── projects/
│   │   │       ├── route.ts        # GET/POST: プロジェクト CRUD
│   │   │       └── [id]/
│   │   │           └── route.ts    # GET/PUT/DELETE: 個別プロジェクト
│   │   └── globals.css
│   ├── components/
│   │   ├── file-browser.tsx        # ファイル選択パネル
│   │   ├── source-files.tsx        # 複数ソースファイル管理 (結合用)
│   │   ├── media-preview.tsx       # 動画/音声プレビュー
│   │   ├── waveform-canvas.tsx     # 波形表示 Canvas
│   │   ├── seekbar.tsx             # シークバー
│   │   ├── timeline-editor.tsx     # タイムライン編集エリア
│   │   ├── timeline-row.tsx        # 個別タイムライン行
│   │   ├── output-settings.tsx     # 出力設定パネル
│   │   └── split-button.tsx        # 分割実行ボタン + 進捗表示
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts            # Drizzle クライアント初期化
│   │   │   ├── schema.ts           # テーブル定義
│   │   │   └── migrate.ts          # マイグレーション実行
│   │   ├── ffmpeg.ts               # FFmpeg ラッパー関数群
│   │   ├── concat.ts               # 複数ファイル結合ロジック
│   │   ├── waveform.ts             # 波形データ生成ロジック
│   │   └── utils.ts                # 時間フォーマット等のユーティリティ
│   ├── hooks/
│   │   ├── use-media-player.ts     # 再生・シーク制御
│   │   ├── use-timelines.ts        # タイムライン状態管理
│   │   └── use-split.ts            # 分割実行・進捗管理
│   └── types/
│       └── index.ts                # 共通型定義
├── drizzle/
│   └── migrations/                 # マイグレーションファイル
├── drizzle.config.ts
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── README.md
```

---

## 4. データベース設計

### 4.1 ER図

```
projects 1 --- * source_files
projects 1 --- * timelines
projects 1 --- 1 project_settings
```

### 4.2 テーブル定義 (Drizzle Schema)

```typescript
// src/lib/db/schema.ts
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),               // nanoid
  name: text("name").notNull(),              // プロジェクト表示名
  concatFilePath: text("concat_file_path"),  // 結合済ファイルのパス (/media/data/concat/{id}.ext)
                                              // 単一ファイルの場合は null (元ファイルを直接参照)
  duration: real("duration"),                 // 総再生時間 (秒)
  mediaType: text("media_type"),              // "video" | "audio"
  concatStatus: text("concat_status")         // null | "pending" | "processing" | "done" | "error"
    .default("done"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const sourceFiles = sqliteTable("source_files", {
  id: text("id").primaryKey(),               // nanoid
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),      // /media/input 内の相対パス
  fileName: text("file_name").notNull(),      // 表示用ファイル名
  duration: real("duration"),                 // この個別ファイルの再生時間
  sortOrder: integer("sort_order").notNull(), // 結合順序
});

export const timelines = sqliteTable("timelines", {
  id: text("id").primaryKey(),               // nanoid
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),              // 出力ファイル名になる
  fromTime: real("from_time").notNull(),     // 開始秒 (結合後の通し時間)
  toTime: real("to_time").notNull(),         // 終了秒 (結合後の通し時間)
  sortOrder: integer("sort_order").notNull(),
});

export const projectSettings = sqliteTable("project_settings", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  outputFormat: text("output_format").notNull().default("copy"),
    // "copy" | "mp3"
  mp3Bitrate: text("mp3_bitrate").default("192k"),
    // "128k" | "192k" | "256k" | "320k"
});
```

### 4.3 プロジェクトのファイル参照ルール

- **単一ファイル:** `sourceFiles` が1件、`concatFilePath` は null。再生・分割には `sourceFiles[0].filePath` を直接使用。
- **複数ファイル:** `sourceFiles` が2件以上、結合処理後に `concatFilePath` にパスがセットされる。再生・分割には結合済ファイルを使用。
- **作業用ファイルパス:** `concatFilePath ?? sourceFiles[0].filePath` で解決。

### 4.3 SQLite ファイルの配置

- パス: `/media/data/media-slicer.db`
- Docker ボリュームマウントで永続化

---

## 5. API 設計

### 5.1 `GET /api/files`

`/media/input` 内のファイル一覧を返す。サブディレクトリも再帰的に走査。

**Response:**
```json
{
  "files": [
    {
      "path": "band/2025-03-01-practice.wav",
      "name": "2025-03-01-practice.wav",
      "size": 1234567890,
      "extension": "wav",
      "mediaType": "audio",
      "modifiedAt": "2025-03-01T18:00:00Z"
    }
  ]
}
```

対応拡張子: `.wav`, `.mp3`, `.mp4`, `.mov`, `.webm`, `.ogg`, `.flac`, `.m4a`

### 5.2 `GET /api/media/[...path]`

メディアファイルを Range Request 対応で配信する。`<video>` / `<audio>` タグからのシークに対応。

- `Accept-Ranges: bytes` ヘッダを返す
- `Range` ヘッダがあれば `206 Partial Content` で部分配信
- Content-Type は拡張子から推定

### 5.3 `POST /api/waveform`

メディアファイルの波形ピークデータを生成して返す。

**Request:**
```json
{
  "filePath": "band/2025-03-01-practice.wav",
  "samplesPerPixel": 256,
  "width": 2000
}
```

**処理フロー:**
1. キャッシュ確認 (`/media/data/waveform-cache/{hash}.json`)
2. キャッシュなければ FFmpeg で音声ストリームを raw PCM に変換
3. PCM データからピーク値(min/max)を指定解像度で算出
4. JSON で返却 + キャッシュ保存

**Response:**
```json
{
  "peaks": [
    { "min": -0.82, "max": 0.91 },
    { "min": -0.45, "max": 0.67 }
  ],
  "duration": 7234.5,
  "sampleRate": 44100,
  "channels": 2
}
```

**FFmpeg コマンド例:**
```bash
ffmpeg -i input.wav -ac 1 -f f32le -ar 8000 pipe:1
```
- モノラルに変換 (`-ac 1`)、32bit float little-endian で出力
- サンプルレートを落として処理量を削減

### 5.4 `POST /api/split`

タイムライン設定に基づいてファイルを分割する。

**Request:**
```json
{
  "projectId": "abc123",
  "segments": [
    { "name": "01-opening", "from": 0, "to": 324.5 },
    { "name": "02-main-song", "from": 324.5, "to": 612.3 }
  ],
  "outputFormat": "mp3",
  "mp3Bitrate": "192k"
}
```

**処理フロー (outputFormat 別):**

**`copy` モード (デフォルト):**
```bash
ffmpeg -i input.mp4 -ss 0 -to 324.5 -c copy -avoid_negative_ts make_zero "01-opening.mp4"
```

**`mp3` モード (wav → mp3 変換):**
```bash
ffmpeg -i input.wav -ss 0 -to 324.5 -codec:a libmp3lame -b:a 192k "01-opening.mp3"
```

**出力先:** `/media/output/{プロジェクト名 or 日時}/`

### 5.5 `GET /api/split-progress`

分割処理の進捗を SSE (Server-Sent Events) で配信。

```
data: {"current": 1, "total": 5, "segment": "02-main-song", "percent": 45}
data: {"current": 2, "total": 5, "segment": "03-solo", "percent": 0}
...
data: {"status": "complete", "outputDir": "/media/output/2025-03-08_practice"}
```

### 5.6 `POST /api/concat`

複数ファイルを FFmpeg の concat demuxer で結合する。

**Request:**
```json
{
  "projectId": "abc123",
  "files": [
    "band/2025-03-01-practice-001.wav",
    "band/2025-03-01-practice-002.wav",
    "band/2025-03-01-practice-003.wav"
  ]
}
```

**処理フロー:**
1. `concatStatus` を `"processing"` に更新
2. concat リストファイルを生成:
   ```
   file '/media/input/band/2025-03-01-practice-001.wav'
   file '/media/input/band/2025-03-01-practice-002.wav'
   file '/media/input/band/2025-03-01-practice-003.wav'
   ```
3. FFmpeg concat 実行:
   ```bash
   ffmpeg -y -f concat -safe 0 -i concat_list.txt -c copy \
     "/media/data/concat/{projectId}.wav"
   ```
4. 完了後、`concatFilePath` と `duration` を更新、`concatStatus` を `"done"` に

**注意:** concat demuxer の `-c copy` は同一コーデック・サンプルレート・解像度が前提。異なる場合はエラーを返しUIで通知する。

**Response:**
```json
{
  "status": "processing",
  "projectId": "abc123"
}
```

### 5.7 `GET /api/concat-progress`

結合処理の進捗を SSE で配信。

```
data: {"projectId": "abc123", "percent": 45, "status": "processing"}
data: {"projectId": "abc123", "percent": 100, "status": "done", "duration": 7234.5}
```

### 5.8 `GET/POST /api/projects`

**GET:** プロジェクト一覧を返す (更新日時降順)

**POST:** 新規プロジェクト作成

**Request:**
```json
{
  "name": "2025-03-01 バンド練習",
  "files": ["band/practice-001.wav", "band/practice-002.wav"]
}
```

**処理フロー:**
1. プロジェクトレコード作成
2. `sourceFiles` を `sortOrder` 順に登録
3. 各ファイルに FFprobe を実行して duration / mediaType を取得
4. ファイルが1つの場合: `concatFilePath` = null、`concatStatus` = `"done"`、即使用可能
5. ファイルが2つ以上の場合: `concatStatus` = `"pending"`、クライアントが `/api/concat` を呼んで結合開始

### 5.9 `GET/PUT/DELETE /api/projects/[id]`

個別プロジェクトの取得・更新・削除。GETでは sourceFiles, timelines, settings を含めて返す。

---

## 6. フロントエンド設計

### 6.1 画面フロー

#### プロジェクト作成画面

```
┌──────────────────────────────────────────────────────┐
│  Media Slicer                                        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  プロジェクト一覧              [+ 新規プロジェクト]  │
│  ┌────────────────────────────────────────────────┐  │
│  │ 📁 2025-03-01 バンド練習  (3 files, 2:01:23)  │  │
│  │ 📁 2025-03-05 Podcast     (1 file, 1:45:00)   │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ── 新規プロジェクト作成 ──                          │
│  プロジェクト名: [2025-03-08 バンド練習          ]   │
│                                                      │
│  ソースファイル:                        [+ 追加]     │
│  ┌────────────────────────────────────────────────┐  │
│  │ 1. practice-001.wav  (42:15)  [↑] [↓] [×]    │  │
│  │ 2. practice-002.wav  (45:30)  [↑] [↓] [×]    │  │
│  │ 3. practice-003.wav  (33:38)  [↑] [↓] [×]    │  │
│  └────────────────────────────────────────────────┘  │
│  合計: 2:01:23                                       │
│                                                      │
│                              [プロジェクト作成 ▶]    │
└──────────────────────────────────────────────────────┘
```

ファイルが2つ以上の場合、作成ボタン押下後に結合処理が走り、進捗バーを表示。
結合完了後にエディター画面へ遷移。

#### エディター画面 (メイン作業画面)

```
┌──────────────────────────────────────────────────────┐
│  Media Slicer  ← 戻る   "2025-03-08 バンド練習"     │  ← ヘッダー
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │                                              │    │
│  │         動画プレビュー / 音声波形             │    │  ← プレビューエリア
│  │              (16:9 / 波形表示)                │    │
│  │                                              │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ──●──────────────────────────────────────── 1:23:45  │  ← メインシークバー
│  ▼file1          ▼file2          ▼file3              │  ← ファイル境界マーカー
│                                                      │
├──────────────────────────────────────────────────────┤
│  タイムライン                              [+ 追加]  │
│  ┌────────────────────────────────────────────────┐  │
│  │ 1. "01-opening"   [Set From] ████████░░ [Set To]│  │  ← タイムライン行
│  │    00:00:00.0 ──────────────── 00:05:24.5       │  │
│  ├────────────────────────────────────────────────┤  │
│  │ 2. "02-main"      [Set From] ░░████████ [Set To]│  │
│  │    00:05:24.5 ──────────────── 00:10:12.3       │  │
│  ├────────────────────────────────────────────────┤  │
│  │ 3. "03-solo"      [Set From] ░░░░░░████ [Set To]│  │
│  │    00:10:12.3 ──────────────── 00:15:00.0       │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
├──────────────────────────────────────────────────────┤
│  出力: [● copy  ○ mp3 ▼ 192k]         [▶ 分割実行]  │  ← フッター
└──────────────────────────────────────────────────────┘
```

複数ファイルのプロジェクトの場合、シークバー下にファイル境界の位置をマーカーで表示。
これにより、どのファイルのどの位置を見ているか把握しやすくなる。

### 6.2 コンポーネント設計

#### `page.tsx` (メインページ)
- 状態: 現在の画面 (プロジェクト一覧 / エディター), 選択中プロジェクト
- プロジェクト一覧とエディターを切り替えるコーディネーター

#### `ProjectList`
- `/api/projects` からプロジェクト一覧を取得
- 既存プロジェクトをクリックしてエディターへ遷移
- 新規プロジェクト作成フローへの導線

#### `ProjectCreator`
- プロジェクト名入力
- `/api/files` からファイルを選択して `SourceFiles` に追加
- 作成ボタンで `/api/projects` POST → 複数ファイルなら `/api/concat` も実行
- 結合進捗バー表示

#### `SourceFiles`
- プロジェクトに紐づくソースファイル一覧
- ドラッグで並び替え (結合順序)
- ファイル追加/削除
- 各ファイルの duration 表示 + 合計表示

#### `FileBrowser`
- `/api/files` からファイル一覧を取得
- ツリービューまたはリスト表示
- 複数ファイル選択対応 (チェックボックス)
- ファイルサイズ、種別アイコン表示

#### `MediaPreview`
- mediaType が "video" の場合: `<video>` タグで映像を表示
- mediaType が "audio" の場合: `WaveformCanvas` のみ表示
- 再生/一時停止、音量調整

#### `WaveformCanvas`
- `/api/waveform` から取得したピークデータを Canvas に描画
- 動画の場合もシークバーの上に小さく波形を表示
- タイムライン各行の from/to 範囲をカラーオーバーレイで可視化
- 現在の再生位置をプレイヘッド (縦線) で表示
- 複数ファイルプロジェクトの場合、ファイル境界位置に縦マーカーを表示

#### `Seekbar`
- メディアの現在位置をドラッグで変更
- 時間表示: `HH:MM:SS.s` 形式
- クリックでシーク

#### `TimelineEditor`
- タイムライン行の配列を管理
- 行の追加 / 削除 / 並び替え (ドラッグ)
- DB と自動同期 (debounce 付き)

#### `TimelineRow`
- 名前入力フィールド
- from / to の時間表示 + 手動入力
- [Set From] / [Set To] ボタン: 現在のシーク位置をセット
- ミニバー: メディア全体に対する from/to の範囲を視覚化
- 行削除ボタン

#### `OutputSettings`
- 出力フォーマット選択: copy / mp3
- mp3 選択時: ビットレート選択 (128k / 192k / 256k / 320k)
- 音声ファイル (wav, flac) の場合のみ mp3 オプションを表示

#### `SplitButton`
- 分割実行ボタン
- SSE で進捗を受信し、プログレスバー表示
- 完了時に出力ディレクトリパスを表示

### 6.3 状態管理

React の `useState` / `useReducer` で管理。グローバルステート管理ライブラリは不使用（1画面アプリのため不要）。

**主要 hooks:**

- `useMediaPlayer`: video/audio 要素の ref 管理、再生・一時停止・シーク・currentTime の同期
- `useTimelines`: タイムライン配列の CRUD、DB 同期 (PUT /api/projects/[id])
- `useSplit`: 分割実行、SSE 接続、進捗状態管理

### 6.4 UIテーマ

ダークテーマ基調の動画編集ツール風デザイン。

- 背景: `zinc-950` / `zinc-900` 系
- パネル区切り: `zinc-800` ボーダー
- アクセント: シアン系 (`cyan-500`) — 再生ヘッド、アクティブなタイムライン
- タイムライン範囲: 半透明のアクセントカラーでオーバーレイ
- フォント: `JetBrains Mono` (時間表示) + システムフォント (UI)
- shadcn/ui のダークテーマをベースにカスタマイズ

---

## 7. FFmpeg 処理詳細

### 7.1 メディア情報取得 (FFprobe)

```bash
ffprobe -v quiet -print_format json -show_format -show_streams input.mp4
```

取得情報: duration, codec_name, width, height, sample_rate, channels, bit_rate

### 7.2 ファイル結合 (concat)

**concat demuxer 方式 (ストリームコピー、高速):**

1. concat リストファイルを生成:
```
file '/media/input/band/practice-001.wav'
file '/media/input/band/practice-002.wav'
file '/media/input/band/practice-003.wav'
```

2. FFmpeg 実行:
```bash
ffmpeg -y -f concat -safe 0 -i concat_list.txt \
  -c copy \
  "/media/data/concat/{projectId}.wav"
```

**前提条件:** 全ファイルが同一コーデック・サンプルレート・解像度であること。
録画ソフトが自動分割したファイルであれば通常この条件を満たす。

**検証:** プロジェクト作成時に各ファイルの FFprobe 結果を比較し、コーデック・解像度・サンプルレートが不一致の場合はエラーを返す。

**結合済ファイルの保存先:** `/media/data/concat/{projectId}.{ext}`
- ボリュームマウントで永続化
- プロジェクト削除時に結合済ファイルも削除

### 7.3 波形生成

```bash
# 音声を低レートのraw PCMに変換
ffmpeg -i input.wav -ac 1 -f f32le -ar 8000 pipe:1
```

Node.js 側で stdout を読み取り、float32 配列としてピーク値を計算:

```typescript
// 擬似コード
const SAMPLES_PER_PIXEL = totalSamples / targetWidth;
for (let i = 0; i < targetWidth; i++) {
  const start = Math.floor(i * SAMPLES_PER_PIXEL);
  const end = Math.floor((i + 1) * SAMPLES_PER_PIXEL);
  const slice = pcmData.subarray(start, end);
  peaks.push({
    min: Math.min(...slice),
    max: Math.max(...slice),
  });
}
```

### 7.4 分割コマンド

**ストリームコピー (動画/音声):**
```bash
ffmpeg -y -i input.mp4 \
  -ss 324.5 -to 612.3 \
  -c copy \
  -avoid_negative_ts make_zero \
  "/media/output/session/02-main-song.mp4"
```

**wav → mp3 変換:**
```bash
ffmpeg -y -i input.wav \
  -ss 324.5 -to 612.3 \
  -codec:a libmp3lame -b:a 192k \
  "/media/output/session/02-main-song.mp3"
```

### 7.5 進捗取得

FFmpeg の `-progress pipe:2` オプションで進捗情報を stderr に出力させ、パースして SSE で配信:

```bash
ffmpeg -y -i input.mp4 -ss 0 -to 324.5 -c copy -progress pipe:2 output.mp4
```

出力例:
```
out_time_ms=125000000
speed=12.5x
progress=continue
```

---

## 8. Docker 構成

### 8.1 Dockerfile

```dockerfile
FROM node:20-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 依存インストール
COPY package.json package-lock.json ./
RUN npm ci

# ソースコピー & ビルド
COPY . .
RUN npm run build

# データディレクトリ作成
RUN mkdir -p /media/input /media/output /media/data/concat /media/data/waveform-cache

EXPOSE 3000

CMD ["npm", "start"]
```

### 8.2 docker-compose.yml

```yaml
version: "3.8"

services:
  media-slicer:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./input:/media/input:ro        # 入力ファイル (読み取り専用)
      - ./output:/media/output          # 出力ファイル
      - ./data:/media/data              # SQLite DB + 波形キャッシュ
    environment:
      - NODE_ENV=production
```

### 8.3 ボリュームマウント

| コンテナパス | ホストパス (例) | 用途 | 権限 |
|-------------|---------------|------|------|
| `/media/input` | `./input` | 入力メディアファイル | 読み取り専用 |
| `/media/output` | `./output` | 分割出力ファイル | 読み書き |
| `/media/data` | `./data` | SQLite DB, 波形キャッシュ, 結合済ファイル | 読み書き |

---

## 9. 実装フェーズ

### Phase 1: 基盤
- Next.js プロジェクト初期化 + Docker ビルド確認
- Drizzle + SQLite セットアップ + マイグレーション
- `/api/files` ファイル一覧API
- `/api/media/[...path]` Range Request 配信

### Phase 2: プロジェクト管理
- ProjectList / ProjectCreator コンポーネント
- SourceFiles コンポーネント (並び替え、追加/削除)
- `/api/projects` CRUD
- `/api/concat` + 結合進捗 SSE
- FFprobe によるコーデック互換性チェック

### Phase 3: プレビュー
- MediaPreview コンポーネント (video/audio 再生)
- 波形生成 API + WaveformCanvas
- Seekbar + 再生制御
- ファイル境界マーカー表示

### Phase 4: タイムライン
- TimelineEditor / TimelineRow コンポーネント
- from/to 設定 UI + 波形オーバーレイ
- タイムライン保存/復元 (DB連携)

### Phase 5: 分割実行
- `/api/split` + FFmpeg 実行
- SSE 進捗配信
- 出力設定 (copy / mp3 + ビットレート)
- 完了通知 + 出力パス表示
