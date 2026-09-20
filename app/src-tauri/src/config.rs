use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub groq_stt_model: String,
    pub primary_llm_model: String,
    pub fallback_llm_model: String,
    pub tts_voice: String,
    pub hotkey: String,
    pub microphone_device: String,
    pub wake_word_enabled: bool,
    pub wake_word_sensitivity: f32,
    pub custom_wakeword_path: String,
    pub onboarding_done: bool,
    #[serde(default)]
    pub mute_agent_voice: bool,
    #[serde(default)]
    pub pause_listening: bool,
    #[serde(default)]
    pub speak_progress_updates: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            groq_stt_model: "whisper-large-v3-turbo".to_string(),
            primary_llm_model: "llama-3.3-70b-specdec".to_string(),
            fallback_llm_model: "meta-llama/llama-3.3-70b-instruct".to_string(),
            tts_voice: "hi-IN-MadhurNeural".to_string(),
            hotkey: "Ctrl+Shift+Space".to_string(),
            microphone_device: "default".to_string(),
            wake_word_enabled: false,
            wake_word_sensitivity: 0.50,
            custom_wakeword_path: "".to_string(),
            onboarding_done: false,
            mute_agent_voice: false,
            pause_listening: false,
            speak_progress_updates: false,
        }
    }
}

pub fn get_config_path() -> PathBuf {
    let mut dir = dirs_next().unwrap_or_else(|| PathBuf::from("."));
    dir.push(".bolocode");
    fs::create_dir_all(&dir).ok();
    dir.push("config.json");
    dir
}

pub fn get_app_dir() -> PathBuf {
    let mut dir = dirs_next().unwrap_or_else(|| PathBuf::from("."));
    dir.push(".bolocode");
    fs::create_dir_all(&dir).ok();
    dir
}

fn dirs_next() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
}

pub fn load_config() -> AppConfig {
    let path = get_config_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(path) {
            if let Ok(cfg) = serde_json::from_str::<AppConfig>(&content) {
                return cfg;
            }
        }
    }
    AppConfig::default()
}

pub fn save_config(cfg: &AppConfig) -> Result<(), String> {
    let path = get_config_path();
    let content = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}
