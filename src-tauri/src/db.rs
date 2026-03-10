use rusqlite::{params, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub concat_file_path: Option<String>,
    pub duration: Option<f64>,
    pub media_type: Option<String>,
    pub concat_status: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceFile {
    pub id: String,
    pub project_id: String,
    pub file_path: String,
    pub file_name: String,
    pub duration: Option<f64>,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Timeline {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub from_time: f64,
    pub to_time: f64,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettings {
    pub project_id: String,
    pub output_format: String,
    pub mp3_bitrate: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDetail {
    #[serde(flatten)]
    pub project: Project,
    pub source_files: Vec<SourceFile>,
    pub timelines: Vec<Timeline>,
    pub settings: Option<ProjectSettings>,
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(data_dir: &PathBuf) -> SqliteResult<Self> {
        std::fs::create_dir_all(data_dir).ok();
        let db_path = data_dir.join("clipsaw.db");
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")?;
        Self::migrate(&conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    fn migrate(conn: &Connection) -> SqliteResult<()> {
        conn.execute_batch(
            "
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
            ",
        )
    }

    // === Projects ===

    pub fn list_projects(&self) -> SqliteResult<Vec<Project>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, concat_file_path, duration, media_type, concat_status, created_at, updated_at
             FROM projects ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                concat_file_path: row.get(2)?,
                duration: row.get(3)?,
                media_type: row.get(4)?,
                concat_status: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        rows.collect()
    }

    pub fn get_project(&self, id: &str) -> SqliteResult<Option<Project>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, concat_file_path, duration, media_type, concat_status, created_at, updated_at
             FROM projects WHERE id = ?1",
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                concat_file_path: row.get(2)?,
                duration: row.get(3)?,
                media_type: row.get(4)?,
                concat_status: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        match rows.next() {
            Some(Ok(p)) => Ok(Some(p)),
            Some(Err(e)) => Err(e),
            None => Ok(None),
        }
    }

    pub fn create_project(&self, project: &Project) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, concat_file_path, duration, media_type, concat_status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                project.id,
                project.name,
                project.concat_file_path,
                project.duration,
                project.media_type,
                project.concat_status,
                project.created_at,
                project.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn update_project_concat(
        &self,
        id: &str,
        concat_file_path: Option<&str>,
        duration: Option<f64>,
        concat_status: &str,
    ) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE projects SET concat_file_path = ?2, duration = ?3, concat_status = ?4, updated_at = ?5 WHERE id = ?1",
            params![id, concat_file_path, duration, concat_status, now],
        )?;
        Ok(())
    }

    pub fn delete_project(&self, id: &str) -> SqliteResult<Option<String>> {
        let conn = self.conn.lock().unwrap();
        // Get concat file path before deleting
        let concat_path: Option<String> = conn
            .query_row(
                "SELECT concat_file_path FROM projects WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .ok();
        conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
        Ok(concat_path)
    }

    // === Source Files ===

    pub fn get_source_files(&self, project_id: &str) -> SqliteResult<Vec<SourceFile>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, file_path, file_name, duration, sort_order
             FROM source_files WHERE project_id = ?1 ORDER BY sort_order",
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(SourceFile {
                id: row.get(0)?,
                project_id: row.get(1)?,
                file_path: row.get(2)?,
                file_name: row.get(3)?,
                duration: row.get(4)?,
                sort_order: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    pub fn get_all_source_files(&self) -> SqliteResult<Vec<SourceFile>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, file_path, file_name, duration, sort_order
             FROM source_files ORDER BY sort_order",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(SourceFile {
                id: row.get(0)?,
                project_id: row.get(1)?,
                file_path: row.get(2)?,
                file_name: row.get(3)?,
                duration: row.get(4)?,
                sort_order: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    pub fn insert_source_file(&self, sf: &SourceFile) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO source_files (id, project_id, file_path, file_name, duration, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![sf.id, sf.project_id, sf.file_path, sf.file_name, sf.duration, sf.sort_order],
        )?;
        Ok(())
    }

    // === Timelines ===

    pub fn get_timelines(&self, project_id: &str) -> SqliteResult<Vec<Timeline>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, from_time, to_time, sort_order
             FROM timelines WHERE project_id = ?1 ORDER BY sort_order",
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(Timeline {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                from_time: row.get(3)?,
                to_time: row.get(4)?,
                sort_order: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    pub fn replace_timelines(&self, project_id: &str, timelines: &[Timeline]) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM timelines WHERE project_id = ?1",
            params![project_id],
        )?;
        for t in timelines {
            conn.execute(
                "INSERT INTO timelines (id, project_id, name, from_time, to_time, sort_order)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![t.id, project_id, t.name, t.from_time, t.to_time, t.sort_order],
            )?;
        }
        Ok(())
    }

    // === Project Settings ===

    pub fn get_settings(&self, project_id: &str) -> SqliteResult<Option<ProjectSettings>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT project_id, output_format, mp3_bitrate FROM project_settings WHERE project_id = ?1",
        )?;
        let mut rows = stmt.query_map(params![project_id], |row| {
            Ok(ProjectSettings {
                project_id: row.get(0)?,
                output_format: row.get(1)?,
                mp3_bitrate: row.get(2)?,
            })
        })?;
        match rows.next() {
            Some(Ok(s)) => Ok(Some(s)),
            Some(Err(e)) => Err(e),
            None => Ok(None),
        }
    }

    pub fn upsert_settings(&self, settings: &ProjectSettings) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO project_settings (project_id, output_format, mp3_bitrate)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(project_id) DO UPDATE SET output_format = ?2, mp3_bitrate = ?3",
            params![settings.project_id, settings.output_format, settings.mp3_bitrate],
        )?;
        Ok(())
    }

    // === Project Detail (combined) ===

    pub fn get_project_detail(&self, id: &str) -> SqliteResult<Option<ProjectDetail>> {
        let project = self.get_project(id)?;
        match project {
            None => Ok(None),
            Some(project) => {
                let source_files = self.get_source_files(id)?;
                let timelines = self.get_timelines(id)?;
                let settings = self.get_settings(id)?;
                Ok(Some(ProjectDetail {
                    project,
                    source_files,
                    timelines,
                    settings,
                }))
            }
        }
    }
}
