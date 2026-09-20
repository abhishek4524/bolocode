use reqwest::Client;
use serde_json::json;
use std::time::Duration;

/// Total HTTP timeout for TTS synthesis
const TTS_HTTP_TIMEOUT: Duration = Duration::from_secs(30);

/// Connect timeout
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

/// Maximum number of characters to send to TTS to prevent abuse / runaway output
const MAX_TTS_CHARS: usize = 2048;

pub async fn synthesize_speech(text: &str, voice: &str) -> Result<Vec<u8>, String> {
    if text.trim().is_empty() {
        return Ok(Vec::new());
    }

    // Truncate overly long text to prevent abuse
    let safe_text = if text.chars().count() > MAX_TTS_CHARS {
        let truncated: String = text.chars().take(MAX_TTS_CHARS).collect();
        format!("{}…", truncated)
    } else {
        text.to_string()
    };

    let client = Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(TTS_HTTP_TIMEOUT)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    // MS Edge TTS REST endpoint / Proxy
    let res = client
        .post("https://edge-tts-api.vercel.app/api/tts")
        .header("Content-Type", "application/json")
        .json(&json!({
            "text": safe_text,
            "voice": voice
        }))
        .send()
        .await;

    match res {
        Ok(resp) if resp.status().is_success() => {
            let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
            if !bytes.is_empty() {
                return Ok(bytes.to_vec());
            }
            Err("Edge TTS returned empty audio bytes".to_string())
        }
        Ok(resp) => Err(format!("Edge TTS HTTP Error {}", resp.status())),
        Err(e) => {
            if e.is_timeout() {
                Err(format!("Edge TTS request timed out after {}s.", TTS_HTTP_TIMEOUT.as_secs()))
            } else if e.is_connect() {
                Err("Edge TTS connection failed — check your internet connection.".to_string())
            } else {
                Err(format!("Edge TTS network error: {}", e))
            }
        }
    }
}
