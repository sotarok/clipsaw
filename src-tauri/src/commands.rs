use crate::db::{Database, Project, ProjectDetail, ProjectSettings, SourceFile, Timeline};
use crate::ffmpeg;
use md5::{Digest, Md5};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use walkdir::WalkDir;

pub struct AppState {
    pub db: Database,
    pub data_dir: PathBuf,
    pub input_dir: Option<PathBuf>,
    pub output_dir: Option<PathBuf>,
}

// === Types ===

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub extension: String,
    pub media_type: String,
    pub modified_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListProjectsResponse {
    pub projects: Vec<ProjectWithSourceFiles>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectWithSourceFiles {
    #[serde(flatten)]
    pub project: Project,
    pub source_files: Vec<SourceFile>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub name: String,
    pub files: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub timelines: Option<Vec<Timeline>>,
    pub settings: Option<ProjectSettings>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SplitSegment {
    pub name: String,
    pub from: f64,
    pub to: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SplitProgress {
    pub current: u32,
    pub total: u32,
    pub segment: String,
    pub percent: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_dir: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConcatProgress {
    pub project_id: String,
    pub percent: u32,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WaveformPeak {
    pub min: f64,
    pub max: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WaveformResponse {
    pub peaks: Vec<WaveformPeak>,
    pub duration: f64,
    pub sample_rate: i32,
    pub channels: i32,
}

// === Commands ===

#[tauri::command]
pub async fn list_projects(state: State<'_, Arc<AppState>>) -> Result<ListProjectsResponse, String> {
    let projects = state.db.list_projects().map_err(|e| e.to_string())?;
    let all_source_files = state.db.get_all_source_files().map_err(|e| e.to_string())?;

    let projects_with_files: Vec<ProjectWithSourceFiles> = projects
        .into_iter()
        .map(|p| {
            let files: Vec<SourceFile> = all_source_files
                .iter()
                .filter(|sf| sf.project_id == p.id)
                .cloned()
                .collect();
            ProjectWithSourceFiles {
                project: p,
                source_files: files,
            }
        })
        .collect();

    Ok(ListProjectsResponse {
        projects: projects_with_files,
    })
}

#[tauri::command]
pub async fn create_project(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    request: CreateProjectRequest,
) -> Result<Project, String> {
    let input_dir = state
        .input_dir
        .as_ref()
        .ok_or("Input directory not configured")?;

    let now = chrono::Utc::now().timestamp_millis();
    let project_id = uuid::Uuid::new_v4().to_string().replace("-", "")[..12].to_string();

    // Probe first file for duration and media type
    let first_file_path = input_dir.join(&request.files[0]);
    let info = ffmpeg::probe_media(&app, first_file_path.to_str().unwrap_or(""))
        .await?;

    let concat_status = if request.files.len() > 1 {
        "pending"
    } else {
        "done"
    };

    let project = Project {
        id: project_id.clone(),
        name: request.name,
        concat_file_path: None,
        duration: Some(info.duration),
        media_type: Some(info.media_type),
        concat_status: Some(concat_status.to_string()),
        created_at: now,
        updated_at: now,
    };

    state.db.create_project(&project).map_err(|e| e.to_string())?;

    // Insert source files
    for (i, file_path) in request.files.iter().enumerate() {
        let full_path = input_dir.join(file_path);
        let duration = if i == 0 {
            Some(info.duration)
        } else {
            ffmpeg::probe_media(&app, full_path.to_str().unwrap_or(""))
                .await
                .map(|info| Some(info.duration))
                .unwrap_or(None)
        };

        let file_name = Path::new(file_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| file_path.clone());

        let sf = SourceFile {
            id: uuid::Uuid::new_v4().to_string().replace("-", "")[..12].to_string(),
            project_id: project_id.clone(),
            file_path: file_path.clone(),
            file_name,
            duration,
            sort_order: i as i32,
        };
        state.db.insert_source_file(&sf).map_err(|e| e.to_string())?;
    }

    // Insert default settings
    let settings = ProjectSettings {
        project_id: project_id.clone(),
        output_format: "copy".to_string(),
        mp3_bitrate: Some("192k".to_string()),
    };
    state.db.upsert_settings(&settings).map_err(|e| e.to_string())?;

    Ok(project)
}

#[tauri::command]
pub async fn get_project(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<ProjectDetail, String> {
    state
        .db
        .get_project_detail(&id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Project not found".to_string())
}

#[tauri::command]
pub async fn update_project(
    state: State<'_, Arc<AppState>>,
    id: String,
    request: UpdateProjectRequest,
) -> Result<(), String> {
    // Update timelines if provided
    if let Some(timelines) = &request.timelines {
        state
            .db
            .replace_timelines(&id, timelines)
            .map_err(|e| e.to_string())?;
    }

    // Update settings if provided
    if let Some(settings) = &request.settings {
        let mut s = settings.clone();
        s.project_id = id.clone();
        state.db.upsert_settings(&s).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_project(state: State<'_, Arc<AppState>>, id: String) -> Result<(), String> {
    let concat_path = state.db.delete_project(&id).map_err(|e| e.to_string())?;

    // Remove concat file if exists
    if let Some(ref path) = concat_path {
        let _ = fs::remove_file(path);
    }

    Ok(())
}

#[tauri::command]
pub async fn list_files(state: State<'_, Arc<AppState>>) -> Result<Vec<FileEntry>, String> {
    let input_dir = state
        .input_dir
        .as_ref()
        .ok_or("Input directory not configured")?;

    if !input_dir.exists() {
        return Ok(vec![]);
    }

    let mut entries = Vec::new();

    for entry in WalkDir::new(input_dir)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.path();
        let ext = path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        if !ffmpeg::SUPPORTED_EXTENSIONS.contains(&ext.as_str()) {
            continue;
        }

        let relative = path
            .strip_prefix(input_dir)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        let metadata = entry.metadata().ok();
        let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified_at = metadata
            .and_then(|m| m.modified().ok())
            .map(|t| {
                let datetime: chrono::DateTime<chrono::Utc> = t.into();
                datetime.to_rfc3339()
            })
            .unwrap_or_default();

        entries.push(FileEntry {
            path: relative,
            name,
            size,
            extension: ext.clone(),
            media_type: ffmpeg::get_media_type(&ext).to_string(),
            modified_at,
        });
    }

    entries.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(entries)
}

#[tauri::command]
pub async fn start_split(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    project_id: String,
    segments: Vec<SplitSegment>,
    output_format: String,
    mp3_bitrate: Option<String>,
    output_sub_dir: Option<String>,
) -> Result<(), String> {
    let project = state
        .db
        .get_project(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or("Project not found")?;

    let input_dir = state
        .input_dir
        .as_ref()
        .ok_or("Input directory not configured")?
        .clone();

    let output_dir_base = state
        .output_dir
        .as_ref()
        .ok_or("Output directory not configured")?
        .clone();

    // Determine input file
    let input_file = if let Some(ref concat_path) = project.concat_file_path {
        PathBuf::from(concat_path)
    } else {
        let source_files = state
            .db
            .get_source_files(&project_id)
            .map_err(|e| e.to_string())?;
        if source_files.is_empty() {
            return Err("No source files".to_string());
        }
        input_dir.join(&source_files[0].file_path)
    };

    // Create output directory
    let dir_name = output_sub_dir
        .map(|s| sanitize_dir_name(&s))
        .unwrap_or_else(|| {
            let name = sanitize_dir_name(&project.name);
            if name.is_empty() {
                chrono::Utc::now().format("%Y-%m-%d-%H-%M-%S").to_string()
            } else {
                name
            }
        });
    let output_dir = output_dir_base.join(&dir_name);
    fs::create_dir_all(&output_dir).map_err(|e| format!("Failed to create output dir: {e}"))?;

    // Spawn background task
    let app_handle = app.clone();
    let segments_clone = segments.clone();
    let output_format_clone = output_format.clone();
    let mp3_bitrate_clone = mp3_bitrate.clone();

    tokio::spawn(async move {
        let total = segments_clone.len() as u32;

        for (i, seg) in segments_clone.iter().enumerate() {
            let sanitized_name = seg
                .name
                .replace(|c: char| "<>:\"/\\|?*\0".contains(c), "_")
                .replace("..", "_");

            let input_ext = ffmpeg::get_extension(input_file.to_str().unwrap_or(""));
            let output_ext = if output_format_clone == "mp3" {
                "mp3".to_string()
            } else {
                input_ext
            };
            let output_file = output_dir.join(format!("{sanitized_name}.{output_ext}"));

            let _ = app_handle.emit(
                "split-progress",
                SplitProgress {
                    current: i as u32 + 1,
                    total,
                    segment: seg.name.clone(),
                    percent: 0,
                    status: None,
                    output_dir: None,
                },
            );

            let seg_name = seg.name.clone();
            let app_for_progress = app_handle.clone();

            let result = ffmpeg::split_media_with_progress(
                &app_handle,
                input_file.to_str().unwrap_or(""),
                output_file.to_str().unwrap_or(""),
                seg.from,
                seg.to,
                &output_format_clone,
                mp3_bitrate_clone.as_deref(),
                move |percent| {
                    let _ = app_for_progress.emit(
                        "split-progress",
                        SplitProgress {
                            current: i as u32 + 1,
                            total,
                            segment: seg_name.clone(),
                            percent,
                            status: None,
                            output_dir: None,
                        },
                    );
                },
            )
            .await;

            if let Err(err) = result {
                let _ = app_handle.emit(
                    "split-progress",
                    SplitProgress {
                        current: i as u32 + 1,
                        total,
                        segment: seg.name.clone(),
                        percent: 0,
                        status: Some("complete".to_string()),
                        output_dir: Some(format!("Error: {err}")),
                    },
                );
                return;
            }
        }

        let _ = app_handle.emit(
            "split-progress",
            SplitProgress {
                current: total,
                total,
                segment: segments_clone.last().map(|s| s.name.clone()).unwrap_or_default(),
                percent: 100,
                status: Some("complete".to_string()),
                output_dir: Some(output_dir.to_string_lossy().to_string()),
            },
        );
    });

    Ok(())
}

#[tauri::command]
pub async fn start_concat(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    project_id: String,
    files: Vec<String>,
) -> Result<(), String> {
    let input_dir = state
        .input_dir
        .as_ref()
        .ok_or("Input directory not configured")?
        .clone();

    let data_dir = state.data_dir.clone();
    let concat_dir = data_dir.join("concat");
    fs::create_dir_all(&concat_dir).map_err(|e| format!("Failed to create concat dir: {e}"))?;

    // Validate file names
    for f in &files {
        if f.contains("..") || f.contains('\n') || f.contains('\r') || f.contains('\0') {
            return Err(format!("Invalid file name: {f}"));
        }
    }

    let ext = ffmpeg::get_extension(&files[0]);
    let output_path = concat_dir.join(format!("{project_id}.{ext}"));
    let list_path = concat_dir.join(format!("{project_id}_list.txt"));

    // Get total duration from source files
    let source_files = state
        .db
        .get_source_files(&project_id)
        .map_err(|e| e.to_string())?;
    let total_duration: f64 = source_files.iter().filter_map(|sf| sf.duration).sum();

    // Update status
    state
        .db
        .update_project_concat(&project_id, None, None, "processing")
        .map_err(|e| e.to_string())?;

    // Write concat list file
    let list_content: String = files
        .iter()
        .map(|f| {
            let full_path = input_dir.join(f);
            let escaped = full_path.to_string_lossy().replace('\'', "'\\''");
            format!("file '{escaped}'")
        })
        .collect::<Vec<_>>()
        .join("\n");
    fs::write(&list_path, &list_content).map_err(|e| format!("Failed to write list file: {e}"))?;

    // Spawn background task
    let app_handle = app.clone();
    let db = state.inner().clone();
    let project_id_for_task = project_id.clone();

    tokio::spawn(async move {
        let _ = app_handle.emit(
            "concat-progress",
            ConcatProgress {
                project_id: project_id_for_task.clone(),
                percent: 0,
                status: "processing".to_string(),
                duration: None,
                error: None,
            },
        );

        let app_for_progress = app_handle.clone();
        let pid = project_id_for_task.clone();

        let result = ffmpeg::concat_media(
            &app_handle,
            list_path.to_str().unwrap_or(""),
            output_path.to_str().unwrap_or(""),
            total_duration,
            move |percent| {
                let _ = app_for_progress.emit(
                    "concat-progress",
                    ConcatProgress {
                        project_id: pid.clone(),
                        percent,
                        status: "processing".to_string(),
                        duration: None,
                        error: None,
                    },
                );
            },
        )
        .await;

        // Clean up list file
        let _ = fs::remove_file(&list_path);

        match result {
            Ok(()) => {
                // Probe result for accurate duration
                let probe_result =
                    ffmpeg::probe_media(&app_handle, output_path.to_str().unwrap_or("")).await;

                let duration = probe_result.as_ref().map(|i| i.duration).ok();

                let _ = db.db.update_project_concat(
                    &project_id_for_task,
                    Some(output_path.to_str().unwrap_or("")),
                    duration,
                    "done",
                );

                let _ = app_handle.emit(
                    "concat-progress",
                    ConcatProgress {
                        project_id: project_id_for_task.clone(),
                        percent: 100,
                        status: "done".to_string(),
                        duration,
                        error: None,
                    },
                );
            }
            Err(err) => {
                let _ = db
                    .db
                    .update_project_concat(&project_id_for_task, None, None, "error");

                let _ = app_handle.emit(
                    "concat-progress",
                    ConcatProgress {
                        project_id: project_id_for_task.clone(),
                        percent: 0,
                        status: "error".to_string(),
                        duration: None,
                        error: Some(err),
                    },
                );
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn generate_waveform(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    file_path: String,
    width: Option<u32>,
) -> Result<WaveformResponse, String> {
    let input_dir = state
        .input_dir
        .as_ref()
        .ok_or("Input directory not configured")?;

    let width = width.unwrap_or(2000);
    let cache_dir = state.data_dir.join("waveform-cache");
    fs::create_dir_all(&cache_dir).map_err(|e| format!("Failed to create cache dir: {e}"))?;

    // Determine full file path - check if it's already absolute
    let full_path = if Path::new(&file_path).is_absolute() {
        PathBuf::from(&file_path)
    } else {
        input_dir.join(&file_path)
    };
    let full_path_str = full_path.to_string_lossy().to_string();

    // Generate cache key
    let metadata = fs::metadata(&full_path).map_err(|e| format!("File not found: {e}"))?;
    let size = metadata.len();
    let mtime = metadata
        .modified()
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0)
        })
        .unwrap_or(0);

    let mut hasher = Md5::new();
    hasher.update(format!("{full_path_str}:{width}:{size}:{mtime}"));
    let cache_key = format!("{:x}", hasher.finalize());
    let cache_path = cache_dir.join(format!("{cache_key}.json"));

    // Check cache
    if cache_path.exists() {
        if let Ok(cached) = fs::read_to_string(&cache_path) {
            if let Ok(response) = serde_json::from_str::<WaveformResponse>(&cached) {
                return Ok(response);
            }
        }
    }

    // Probe for metadata
    let info = ffmpeg::probe_media(&app, &full_path_str).await?;

    // Generate PCM
    let target_samples = width * 4;
    let pcm_data = ffmpeg::generate_pcm(&app, &full_path_str, target_samples).await?;

    // Convert to f32 samples
    let total_samples = pcm_data.len() / 4;
    let samples: Vec<f32> = (0..total_samples)
        .map(|i| {
            let bytes = [
                pcm_data[i * 4],
                pcm_data[i * 4 + 1],
                pcm_data[i * 4 + 2],
                pcm_data[i * 4 + 3],
            ];
            f32::from_le_bytes(bytes)
        })
        .collect();

    let samples_per_pixel = if width > 0 {
        total_samples as f64 / width as f64
    } else {
        1.0
    };

    let mut peaks = Vec::with_capacity(width as usize);

    for i in 0..width as usize {
        let start = (i as f64 * samples_per_pixel) as usize;
        let end = (((i + 1) as f64 * samples_per_pixel) as usize).min(total_samples);

        if start >= end {
            peaks.push(WaveformPeak { min: 0.0, max: 0.0 });
            continue;
        }

        let mut min = f64::INFINITY;
        let mut max = f64::NEG_INFINITY;

        for j in start..end {
            let val = samples[j] as f64;
            if val < min {
                min = val;
            }
            if val > max {
                max = val;
            }
        }

        peaks.push(WaveformPeak {
            min: (min * 1000.0).round() / 1000.0,
            max: (max * 1000.0).round() / 1000.0,
        });
    }

    let result = WaveformResponse {
        peaks,
        duration: info.duration,
        sample_rate: info.sample_rate.unwrap_or(44100),
        channels: info.channels.unwrap_or(2),
    };

    // Save cache
    if let Ok(json) = serde_json::to_string(&result) {
        let _ = fs::write(&cache_path, &json);
    }

    Ok(result)
}

#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        tokio::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {e}"))?;
    }
    #[cfg(target_os = "windows")]
    {
        tokio::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {e}"))?;
    }
    #[cfg(target_os = "linux")]
    {
        tokio::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_app_dirs(state: State<'_, Arc<AppState>>) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "dataDir": state.data_dir.to_string_lossy(),
        "inputDir": state.input_dir.as_ref().map(|p| p.to_string_lossy().to_string()),
        "outputDir": state.output_dir.as_ref().map(|p| p.to_string_lossy().to_string()),
    }))
}

#[tauri::command]
pub async fn set_input_dir(
    state: State<'_, Arc<AppState>>,
    path: String,
) -> Result<(), String> {
    // We can't mutate through Arc directly, so store in a config file
    let config_path = state.data_dir.join("config.json");
    let mut config = load_config(&config_path);
    config["inputDir"] = serde_json::json!(path);
    save_config(&config_path, &config)?;
    Ok(())
}

#[tauri::command]
pub async fn set_output_dir(
    state: State<'_, Arc<AppState>>,
    path: String,
) -> Result<(), String> {
    let config_path = state.data_dir.join("config.json");
    let mut config = load_config(&config_path);
    config["outputDir"] = serde_json::json!(path);
    save_config(&config_path, &config)?;
    Ok(())
}

fn sanitize_dir_name(name: &str) -> String {
    name.chars()
        .map(|c| if "<>:\"/\\|?*".contains(c) { '_' } else { c })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join("_")
}

pub fn load_config(path: &Path) -> serde_json::Value {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({}))
}

pub fn save_config(path: &Path, config: &serde_json::Value) -> Result<(), String> {
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| format!("Failed to save config: {e}"))
}
