use reqwest::multipart::{Form, Part};
use reqwest::Client;
use serde_json::Value;
use std::time::Duration;

const CODING_PROMPT_HINT: &str = "folder, file, function, React, npm, JavaScript, TypeScript, root, VS Code, code, create, delete, write, edit, search, terminal, command, git";

/// Total HTTP timeout for Whisper transcription (large audio files need more time)
const STT_HTTP_TIMEOUT: Duration = Duration::from_secs(60);

/// Connect timeout
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

pub async fn transcribe_audio(
    api_key: &str,
    model: &str,
    audio_bytes: Vec<u8>,
) -> Result<String, String> {
    if api_key.trim().is_empty() {
        return Err("Groq API key is missing. Please set your Groq API key in Settings.".to_string());
    }

    if audio_bytes.is_empty() {
        return Err("Audio recording is empty. Please speak into the microphone and try again.".to_string());
    }

    // Max audio size: 25 MB (Groq Whisper API limit)
    const MAX_AUDIO_BYTES: usize = 25 * 1024 * 1024;
    if audio_bytes.len() > MAX_AUDIO_BYTES {
        return Err(format!(
            "Audio file too large ({:.1} MB). Maximum allowed is 25 MB.",
            audio_bytes.len() as f64 / 1024.0 / 1024.0
        ));
    }

    let client = Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(STT_HTTP_TIMEOUT)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let file_part = Part::bytes(audio_bytes)
        .file_name("recording.wav")
        .mime_str("audio/wav")
        .map_err(|e| e.to_string())?;

    // Multipart form: auto-detect language (do NOT set language parameter)
    let form = Form::new()
        .text("model", model.to_string())
        .text("response_format", "json")
        .text("prompt", CODING_PROMPT_HINT.to_string())
        .part("file", file_part);

    let res = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                format!("Groq STT request timed out after {}s. Try speaking a shorter message.", STT_HTTP_TIMEOUT.as_secs())
            } else if e.is_connect() {
                "Groq STT connection failed — check your internet connection.".to_string()
            } else {
                format!("Groq STT network connection error: {}", e)
            }
        })?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Groq Whisper STT API Error: {}", err_text));
    }

    let json_resp: Value = res.json().await.map_err(|e| e.to_string())?;
    if let Some(text) = json_resp.get("text").and_then(|t| t.as_str()) {
        Ok(text.trim().to_string())
    } else {
        Err("Failed to extract transcription text from Groq response".to_string())
    }
}
