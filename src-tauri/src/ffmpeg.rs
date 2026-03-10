use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    pub duration: f64,
    pub media_type: String,
    pub codec_name: String,
    pub sample_rate: Option<i32>,
    pub channels: Option<i32>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub bit_rate: Option<i64>,
}

/// Resolve the sidecar binary path for ffmpeg/ffprobe
fn sidecar_path(app: &AppHandle, name: &str) -> String {
    app.path()
        .resolve(format!("bin/{name}"), tauri::path::BaseDirectory::Resource)
        .map(|p: std::path::PathBuf| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| name.to_string())
}

/// Get media info via FFprobe
pub async fn probe_media(app: &AppHandle, file_path: &str) -> Result<MediaInfo, String> {
    let ffprobe = sidecar_path(app, "ffprobe");
    let output = Command::new(&ffprobe)
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            file_path,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffprobe: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffprobe failed: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let data: serde_json::Value =
        serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse ffprobe output: {e}"))?;

    let format = &data["format"];
    let streams = data["streams"].as_array();

    let video_stream = streams
        .and_then(|s| s.iter().find(|s| s["codec_type"] == "video"));
    let audio_stream = streams
        .and_then(|s| s.iter().find(|s| s["codec_type"] == "audio"));

    let media_type = if video_stream.is_some() { "video" } else { "audio" };
    let primary_stream = video_stream.or(audio_stream);

    Ok(MediaInfo {
        duration: format["duration"]
            .as_str()
            .and_then(|d| d.parse::<f64>().ok())
            .unwrap_or(0.0),
        media_type: media_type.to_string(),
        codec_name: primary_stream
            .and_then(|s| s["codec_name"].as_str())
            .unwrap_or("unknown")
            .to_string(),
        sample_rate: audio_stream
            .and_then(|s| s["sample_rate"].as_str())
            .and_then(|r| r.parse().ok()),
        channels: audio_stream
            .and_then(|s| s["channels"].as_i64())
            .map(|c| c as i32),
        width: video_stream
            .and_then(|s| s["width"].as_i64())
            .map(|w| w as i32),
        height: video_stream
            .and_then(|s| s["height"].as_i64())
            .map(|h| h as i32),
        bit_rate: format["bit_rate"]
            .as_str()
            .and_then(|b| b.parse().ok()),
    })
}

/// Split media file without progress
pub async fn split_media(
    app: &AppHandle,
    input: &str,
    output: &str,
    from: f64,
    to: f64,
    format: &str,
    bitrate: Option<&str>,
) -> Result<(), String> {
    let ffmpeg = sidecar_path(app, "ffmpeg");
    let mut args = vec![
        "-y".to_string(),
        "-i".to_string(),
        input.to_string(),
        "-ss".to_string(),
        from.to_string(),
        "-to".to_string(),
        to.to_string(),
    ];

    if format == "mp3" {
        args.extend([
            "-codec:a".to_string(),
            "libmp3lame".to_string(),
            "-b:a".to_string(),
            bitrate.unwrap_or("192k").to_string(),
        ]);
    } else {
        args.extend([
            "-c".to_string(),
            "copy".to_string(),
            "-avoid_negative_ts".to_string(),
            "make_zero".to_string(),
        ]);
    }

    args.extend([
        "-progress".to_string(),
        "pipe:2".to_string(),
        output.to_string(),
    ]);

    let result = Command::new(&ffmpeg)
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {e}"))?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        let tail: String = stderr.chars().rev().take(500).collect::<String>().chars().rev().collect();
        return Err(format!("ffmpeg split failed: {tail}"));
    }
    Ok(())
}

/// Split media with progress reporting via callback
pub async fn split_media_with_progress<F>(
    app: &AppHandle,
    input: &str,
    output: &str,
    from: f64,
    to: f64,
    format: &str,
    bitrate: Option<&str>,
    on_progress: F,
) -> Result<(), String>
where
    F: Fn(u32) + Send + 'static,
{
    let ffmpeg = sidecar_path(app, "ffmpeg");
    let duration = to - from;
    let mut args = vec![
        "-y".to_string(),
        "-i".to_string(),
        input.to_string(),
        "-ss".to_string(),
        from.to_string(),
        "-to".to_string(),
        to.to_string(),
    ];

    if format == "mp3" {
        args.extend([
            "-codec:a".to_string(),
            "libmp3lame".to_string(),
            "-b:a".to_string(),
            bitrate.unwrap_or("192k").to_string(),
        ]);
    } else {
        args.extend([
            "-c".to_string(),
            "copy".to_string(),
            "-avoid_negative_ts".to_string(),
            "make_zero".to_string(),
        ]);
    }

    args.extend([
        "-progress".to_string(),
        "pipe:2".to_string(),
        output.to_string(),
    ]);

    let mut child = Command::new(&ffmpeg)
        .args(&args)
        .stderr(std::process::Stdio::piped())
        .stdout(std::process::Stdio::null())
        .stdin(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {e}"))?;

    let stderr = child.stderr.take().ok_or("No stderr")?;
    let reader = BufReader::new(stderr);
    let mut lines = reader.lines();

    while let Ok(Some(line)) = lines.next_line().await {
        if let Some(caps) = line.strip_prefix("out_time_ms=") {
            if let Ok(us) = caps.trim().parse::<i64>() {
                if duration > 0.0 {
                    let out_time_sec = us as f64 / 1_000_000.0;
                    let pct = ((out_time_sec / duration) * 100.0).min(100.0) as u32;
                    on_progress(pct);
                }
            }
        }
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for ffmpeg: {e}"))?;

    if status.success() {
        on_progress(100);
        Ok(())
    } else {
        Err(format!("ffmpeg split exited with code {:?}", status.code()))
    }
}

/// Concat files using concat demuxer
pub async fn concat_media<F>(
    app: &AppHandle,
    list_file_path: &str,
    output_path: &str,
    total_duration: f64,
    on_progress: F,
) -> Result<(), String>
where
    F: Fn(u32) + Send + 'static,
{
    let ffmpeg = sidecar_path(app, "ffmpeg");
    let args = vec![
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", list_file_path,
        "-c", "copy",
        "-progress", "pipe:2",
        output_path,
    ];

    let mut child = Command::new(&ffmpeg)
        .args(&args)
        .stderr(std::process::Stdio::piped())
        .stdout(std::process::Stdio::null())
        .stdin(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {e}"))?;

    let stderr = child.stderr.take().ok_or("No stderr")?;
    let reader = BufReader::new(stderr);
    let mut lines = reader.lines();

    while let Ok(Some(line)) = lines.next_line().await {
        if let Some(caps) = line.strip_prefix("out_time_ms=") {
            if let Ok(us) = caps.trim().parse::<i64>() {
                if total_duration > 0.0 {
                    let out_time_sec = us as f64 / 1_000_000.0;
                    let pct = ((out_time_sec / total_duration) * 100.0).min(100.0) as u32;
                    on_progress(pct);
                }
            }
        }
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for ffmpeg: {e}"))?;

    if status.success() {
        on_progress(100);
        Ok(())
    } else {
        Err(format!("ffmpeg concat exited with code {:?}", status.code()))
    }
}

/// Generate raw PCM data for waveform visualization
pub async fn generate_pcm(
    app: &AppHandle,
    file_path: &str,
    target_samples: u32,
) -> Result<Vec<u8>, String> {
    let ffmpeg = sidecar_path(app, "ffmpeg");
    let sample_rate = target_samples.max(100).min(8000);
    let args = vec![
        "-i".to_string(),
        file_path.to_string(),
        "-ac".to_string(),
        "1".to_string(),
        "-f".to_string(),
        "f32le".to_string(),
        "-ar".to_string(),
        sample_rate.to_string(),
        "pipe:1".to_string(),
    ];

    let output = Command::new(&ffmpeg)
        .args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .stdin(std::process::Stdio::null())
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg pcm: {e}"))?;

    if !output.status.success() {
        return Err("ffmpeg pcm generation failed".to_string());
    }

    Ok(output.stdout)
}

/// Get file extension
pub fn get_extension(filename: &str) -> String {
    Path::new(filename)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

/// Determine media type from extension
pub fn get_media_type(ext: &str) -> &str {
    match ext {
        "mp4" | "mov" | "webm" => "video",
        _ => "audio",
    }
}

/// Supported media extensions
pub const SUPPORTED_EXTENSIONS: &[&str] = &["wav", "mp3", "mp4", "mov", "webm", "ogg", "flac", "m4a"];
