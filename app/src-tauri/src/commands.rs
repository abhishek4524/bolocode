use crate::config::{load_config, save_config as save_cfg, AppConfig};
use crate::instance_discovery::{discover_instances, get_instances_dir_path, VSCodeInstance};
use crate::keychain::{get_api_key, set_api_key};
use crate::llm_client::{chat_completion, LlmChatResult};
use crate::logger::read_app_logs;
use crate::stt_groq::transcribe_audio;
use crate::tts_engine::synthesize_speech;
use crate::wakeword_engine::{
    build_wakeword_model, clear_wakeword_samples, get_wakeword_sample_count,
    save_wakeword_sample, set_wakeword_paused, start_wakeword_listener, stop_wakeword_listener,
    test_wakeword_audio, DetectionResult,
};
use crate::ws_client::connect_and_execute_tool;
use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
pub struct CallToolResult {
    pub success: bool,
    pub data: Option<Value>,
    pub error: Option<String>,
    pub needs_confirmation: bool,
    pub confirmation_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionStatus {
    pub is_connected: bool,
    pub scanned_path: String,
    pub active_instances: Vec<VSCodeInstance>,
    pub selected_instance: Option<VSCodeInstance>,
    pub status_message: String,
    pub log_lines: Vec<String>,
}

#[tauri::command]
pub fn list_instances() -> Vec<VSCodeInstance> {
    discover_instances()
}

#[tauri::command]
pub fn check_connection_status() -> ConnectionStatus {
    let path = get_instances_dir_path();
    let instances = discover_instances();
    let logs = read_app_logs(50);

    if instances.is_empty() {
        ConnectionStatus {
            is_connected: false,
            scanned_path: path.clone(),
            active_instances: vec![],
            selected_instance: None,
            status_message: format!("No reachable VS Code instances found in {}", path),
            log_lines: logs,
        }
    } else {
        let primary = instances[0].clone();
        ConnectionStatus {
            is_connected: true,
            scanned_path: path,
            active_instances: instances,
            selected_instance: Some(primary.clone()),
            status_message: format!(
                "Connected to {} (Port: {})",
                primary.workspace.unwrap_or_else(|| "Workspace Root".to_string()),
                primary.port
            ),
            log_lines: logs,
        }
    }
}

#[tauri::command]
pub fn get_app_logs(max_lines: Option<usize>) -> Vec<String> {
    read_app_logs(max_lines.unwrap_or(100))
}

#[tauri::command]
pub async fn connect_manual(port: u16, token: String) -> CallToolResult {
    match connect_and_execute_tool(None, Some(port), Some(token), "get_active_file", Value::Object(Default::default()), false).await {
        Ok(data) => CallToolResult {
            success: true,
            data: Some(data),
            error: None,
            needs_confirmation: false,
            confirmation_reason: None,
        },
        Err(err) => CallToolResult {
            success: false,
            data: None,
            error: Some(err),
            needs_confirmation: false,
            confirmation_reason: None,
        },
    }
}

#[tauri::command]
pub fn save_api_key(service: String, key: String) -> Result<(), String> {
    set_api_key(&service, &key)
}

#[tauri::command]
pub fn get_api_key_cmd(service: String) -> Result<Option<String>, String> {
    get_api_key(&service)
}

#[tauri::command]
pub fn get_app_settings() -> AppConfig {
    load_config()
}

#[tauri::command]
pub fn save_app_settings(config: AppConfig) -> Result<(), String> {
    save_cfg(&config)
}

#[tauri::command]
pub fn toggle_mute_cmd() -> Result<bool, String> {
    let mut cfg = load_config();
    cfg.mute_agent_voice = !cfg.mute_agent_voice;
    save_cfg(&cfg)?;
    Ok(cfg.mute_agent_voice)
}

#[tauri::command]
pub fn toggle_pause_listening_cmd() -> Result<bool, String> {
    let mut cfg = load_config();
    cfg.pause_listening = !cfg.pause_listening;
    save_cfg(&cfg)?;
    Ok(cfg.pause_listening)
}

#[tauri::command]
pub async fn call_tool(
    name: String,
    args: Value,
    confirmed: Option<bool>,
    pid: Option<u32>,
    manual_port: Option<u16>,
    manual_token: Option<String>,
) -> CallToolResult {
    let user_confirmed = confirmed.unwrap_or(false);

    match connect_and_execute_tool(pid, manual_port, manual_token, &name, args, user_confirmed).await {
        Ok(data) => CallToolResult {
            success: true,
            data: Some(data),
            error: None,
            needs_confirmation: false,
            confirmation_reason: None,
        },
        Err(err) if err.starts_with("REQUIRES_CONFIRMATION:") => {
            let reason = err.trim_start_matches("REQUIRES_CONFIRMATION: ").to_string();
            CallToolResult {
                success: false,
                data: None,
                error: Some("REQUIRES_CONFIRMATION".to_string()),
                needs_confirmation: true,
                confirmation_reason: Some(reason),
            }
        }
        Err(err) => CallToolResult {
            success: false,
            data: None,
            error: Some(err),
            needs_confirmation: false,
            confirmation_reason: None,
        },
    }
}

#[tauri::command]
pub async fn llm_chat(
    messages: Vec<Value>,
    tools: Option<Vec<Value>>,
) -> Result<LlmChatResult, String> {
    let cfg = load_config();
    let groq_key = get_api_key("groq")?.unwrap_or_default();
    let openrouter_key = get_api_key("openrouter")?.unwrap_or_default();

    chat_completion(
        messages,
        tools,
        Some(&groq_key),
        Some(&openrouter_key),
        &cfg.primary_llm_model,
        &cfg.fallback_llm_model,
    )
    .await
}

#[tauri::command]
pub async fn stt_transcribe(audio_base64: String) -> Result<String, String> {
    let cfg = load_config();
    let groq_key = get_api_key("groq")?.unwrap_or_default();

    let audio_bytes = general_purpose::STANDARD
        .decode(&audio_base64)
        .map_err(|e| format!("Base64 audio decoding error: {}", e))?;

    transcribe_audio(&groq_key, &cfg.groq_stt_model, audio_bytes).await
}

#[tauri::command]
pub async fn tts_speak(text: String, voice: Option<String>) -> Result<String, String> {
    let cfg = load_config();
    let target_voice = voice.unwrap_or(cfg.tts_voice);

    let bytes = synthesize_speech(&text, &target_voice).await?;
    Ok(general_purpose::STANDARD.encode(bytes))
}

// Wake Word Tauri Commands
#[tauri::command]
pub fn start_wakeword_cmd(
    app: tauri::AppHandle,
    sensitivity: Option<f32>,
    model_path: Option<String>,
) -> Result<(), String> {
    let cfg = load_config();
    let sens = sensitivity.unwrap_or(cfg.wake_word_sensitivity);
    let custom_path = model_path.or_else(|| {
        if !cfg.custom_wakeword_path.is_empty() {
            Some(cfg.custom_wakeword_path)
        } else {
            None
        }
    });

    start_wakeword_listener(app, sens, custom_path)
}

#[tauri::command]
pub fn stop_wakeword_cmd() {
    stop_wakeword_listener();
}

#[tauri::command]
pub fn set_wakeword_paused_cmd(paused: bool) {
    set_wakeword_paused(paused);
}

#[tauri::command]
pub fn save_wakeword_sample_cmd(
    sample_index: usize,
    audio_base64: String,
) -> Result<String, String> {
    save_wakeword_sample(sample_index, audio_base64)
}

#[tauri::command]
pub fn get_wakeword_sample_count_cmd() -> usize {
    get_wakeword_sample_count()
}

#[tauri::command]
pub fn clear_wakeword_samples_cmd() -> Result<(), String> {
    clear_wakeword_samples()
}

#[tauri::command]
pub fn build_wakeword_model_cmd() -> Result<String, String> {
    build_wakeword_model()
}

#[tauri::command]
pub fn test_wakeword_audio_cmd(
    audio_base64: String,
    sensitivity: Option<f32>,
) -> Result<DetectionResult, String> {
    let cfg = load_config();
    let sens = sensitivity.unwrap_or(cfg.wake_word_sensitivity);
    test_wakeword_audio(audio_base64, sens)
}
