use crate::config::get_app_dir;
use base64::{engine::general_purpose, Engine as _};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use rustpotter::{Rustpotter, RustpotterConfig, WakewordRef, WakewordRefBuildFromFiles, WakewordSave};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Emitter;

static WAKEWORD_RUNNING: AtomicBool = AtomicBool::new(false);
static WAKEWORD_PAUSED: AtomicBool = AtomicBool::new(false);
static LAST_DETECTION: Mutex<Option<Instant>> = Mutex::new(None);

#[derive(Debug, Serialize, Deserialize)]
pub struct DetectionResult {
    pub detected: bool,
    pub score: f32,
    pub name: Option<String>,
}

pub fn get_wakeword_model_path() -> PathBuf {
    let mut path = get_app_dir();
    path.push("wakeword.rpw");
    path
}

pub fn get_samples_dir() -> PathBuf {
    let mut dir = get_app_dir();
    dir.push("wakeword_samples");
    fs::create_dir_all(&dir).ok();
    dir
}

pub fn set_wakeword_paused(paused: bool) {
    WAKEWORD_PAUSED.store(paused, Ordering::SeqCst);
}

pub fn stop_wakeword_listener() {
    WAKEWORD_RUNNING.store(false, Ordering::SeqCst);
}

pub fn start_wakeword_listener(
    app: tauri::AppHandle,
    sensitivity: f32,
    custom_path: Option<String>,
) -> Result<(), String> {
    if WAKEWORD_RUNNING.load(Ordering::SeqCst) {
        return Ok(());
    }

    let model_path = if let Some(p) = custom_path {
        if !p.trim().is_empty() {
            PathBuf::from(p)
        } else {
            get_wakeword_model_path()
        }
    } else {
        get_wakeword_model_path()
    };

    if !model_path.exists() {
        return Err(format!(
            "Wake word model file not found at {}. Please train your wake word first.",
            model_path.display()
        ));
    }

    // Configure Rustpotter
    let mut config = RustpotterConfig::default();
    config.detector.avg_threshold = sensitivity;

    let mut rustpotter = Rustpotter::new(&config)
        .map_err(|e| format!("Failed to create Rustpotter detector: {:?}", e))?;

    rustpotter
        .add_wakeword_from_file("hey_bolo", &model_path.to_string_lossy())
        .map_err(|e| format!("Failed to load wakeword model from file: {:?}", e))?;

    WAKEWORD_RUNNING.store(true, Ordering::SeqCst);
    WAKEWORD_PAUSED.store(false, Ordering::SeqCst);

    let rustpotter_arc = Arc::new(Mutex::new(rustpotter));

    // Spawn background cpal recording & detection thread
    thread::spawn(move || {
        let host = cpal::default_host();
        let device = match host.default_input_device() {
            Some(dev) => dev,
            None => {
                tracing::warn!("No input audio device found for wake word listener.");
                WAKEWORD_RUNNING.store(false, Ordering::SeqCst);
                return;
            }
        };

        let config: cpal::StreamConfig = match device.default_input_config() {
            Ok(cfg) => cfg.into(),
            Err(e) => {
                tracing::warn!("Failed to get default input config: {}", e);
                WAKEWORD_RUNNING.store(false, Ordering::SeqCst);
                return;
            }
        };

        let sample_rate = config.sample_rate.0;
        let channels = config.channels as usize;
        let rp_clone = Arc::clone(&rustpotter_arc);

        let stream_res = device.build_input_stream(
            &config,
            move |data: &[f32], _: &_| {
                if !WAKEWORD_RUNNING.load(Ordering::SeqCst) {
                    return;
                }
                if WAKEWORD_PAUSED.load(Ordering::SeqCst) {
                    return;
                }

                // 2-second detection cooldown check
                if let Ok(last) = LAST_DETECTION.lock() {
                    if let Some(instant) = *last {
                        if instant.elapsed() < Duration::from_secs(2) {
                            return;
                        }
                    }
                }

                // Downsample / downmix to 16kHz mono float for Rustpotter
                let mono_samples: Vec<f32> = if channels > 1 {
                    data.chunks(channels).map(|chunk| chunk[0]).collect()
                } else {
                    data.to_vec()
                };

                let samples_16k = if sample_rate != 16000 && sample_rate > 0 {
                    let step = sample_rate as f32 / 16000.0;
                    let mut resampled = Vec::new();
                    let mut idx = 0.0f32;
                    while (idx as usize) < mono_samples.len() {
                        resampled.push(mono_samples[idx as usize]);
                        idx += step;
                    }
                    resampled
                } else {
                    mono_samples
                };

                if let Ok(mut rp) = rp_clone.lock() {
                    if let Some(detection) = rp.process_samples(samples_16k) {
                        tracing::info!("Wake word detected! Score: {}", detection.score);
                        if let Ok(mut last) = LAST_DETECTION.lock() {
                            *last = Some(Instant::now());
                        }
                        let _ = app.emit(
                            "wake-word-detected",
                            json!({
                                "name": detection.name,
                                "score": detection.score
                            }),
                        );
                    }
                }
            },
            move |err| {
                tracing::warn!("cpal audio stream error: {}", err);
            },
            None,
        );

        match stream_res {
            Ok(stream) => {
                if stream.play().is_err() {
                    tracing::warn!("Failed to play cpal input stream.");
                    WAKEWORD_RUNNING.store(false, Ordering::SeqCst);
                    return;
                }

                while WAKEWORD_RUNNING.load(Ordering::SeqCst) {
                    thread::sleep(Duration::from_millis(200));
                }

                let _ = stream.pause();
            }
            Err(e) => {
                tracing::warn!("Failed to build cpal input stream: {}", e);
                WAKEWORD_RUNNING.store(false, Ordering::SeqCst);
            }
        }
    });

    Ok(())
}

pub fn save_wakeword_sample(sample_index: usize, audio_base64: String) -> Result<String, String> {
    let bytes = general_purpose::STANDARD
        .decode(&audio_base64)
        .map_err(|e| format!("Base64 decoding failed: {}", e))?;

    if bytes.is_empty() {
        return Err("Audio bytes empty".to_string());
    }

    let dir = get_samples_dir();
    let file_path = dir.join(format!("sample_{}.wav", sample_index));

    fs::write(&file_path, bytes).map_err(|e| e.to_string())?;
    Ok(file_path.to_string_lossy().to_string())
}

pub fn get_wakeword_sample_count() -> usize {
    let dir = get_samples_dir();
    if let Ok(entries) = fs::read_dir(dir) {
        entries
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .map_or(false, |ext| ext == "wav")
            })
            .count()
    } else {
        0
    }
}

pub fn clear_wakeword_samples() -> Result<(), String> {
    let dir = get_samples_dir();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if entry.path().extension().map_or(false, |ext| ext == "wav") {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
    Ok(())
}

pub fn build_wakeword_model() -> Result<String, String> {
    let dir = get_samples_dir();
    let mut sample_paths = Vec::new();

    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "wav") {
                sample_paths.push(path.to_string_lossy().to_string());
            }
        }
    }

    if sample_paths.len() < 3 {
        return Err(format!(
            "At least 3 samples are required to build a wake word model (found {}).",
            sample_paths.len()
        ));
    }

    let wakeword_ref = WakewordRef::new_from_sample_files(
        "hey_bolo".to_string(),
        None,
        None,
        sample_paths,
        16000,
    )
    .map_err(|e| format!("Failed to build WakewordRef from sample files: {:?}", e))?;

    let output_path = get_wakeword_model_path();
    wakeword_ref
        .save_to_file(&output_path.to_string_lossy())
        .map_err(|e| format!("Failed to save wakeword model to file: {:?}", e))?;

    Ok(output_path.to_string_lossy().to_string())
}

pub fn test_wakeword_audio(
    audio_base64: String,
    sensitivity: f32,
) -> Result<DetectionResult, String> {
    let model_path = get_wakeword_model_path();
    if !model_path.exists() {
        return Err("No wakeword.rpw model found to test against.".to_string());
    }

    let bytes = general_purpose::STANDARD
        .decode(&audio_base64)
        .map_err(|e| format!("Base64 decoding failed: {}", e))?;

    // Parse WAV audio samples using hound crate
    let reader = hound::WavReader::new(&bytes[..])
        .map_err(|e| format!("WAV parsing error: {}", e))?;

    let spec = reader.spec();
    let samples_f32: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Float => reader.into_samples::<f32>().filter_map(|s| s.ok()).collect(),
        hound::SampleFormat::Int => {
            let max_val = 1u32 << (spec.bits_per_sample - 1);
            reader
                .into_samples::<i32>()
                .filter_map(|s| s.ok())
                .map(|s| s as f32 / max_val as f32)
                .collect()
        }
    };

    let mut config = RustpotterConfig::default();
    config.detector.avg_threshold = sensitivity;

    let mut rustpotter = Rustpotter::new(&config)
        .map_err(|e| format!("Failed to create Rustpotter: {:?}", e))?;

    rustpotter
        .add_wakeword_from_file("hey_bolo", &model_path.to_string_lossy())
        .map_err(|e| format!("Failed to load model: {:?}", e))?;

    let result = rustpotter.process_samples(samples_f32);
    if let Some(detection) = result {
        Ok(DetectionResult {
            detected: true,
            score: detection.score,
            name: Some(detection.name),
        })
    } else {
        Ok(DetectionResult {
            detected: false,
            score: 0.0,
            name: None,
        })
    }
}
