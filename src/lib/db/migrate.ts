import type Database from "better-sqlite3";

export function migrate(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      concat_file_path TEXT,
      duration REAL,
      media_type TEXT,
      concat_status TEXT DEFAULT 'done',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS source_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      duration REAL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS timelines (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      from_time REAL NOT NULL,
      to_time REAL NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_settings (
      project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
      output_format TEXT NOT NULL DEFAULT 'copy',
      mp3_bitrate TEXT DEFAULT '192k'
    );
  `);
}
