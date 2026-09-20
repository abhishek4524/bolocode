use reqwest::Client;
use serde_json::json;
use std::time::Duration;

/// Total HTTP timeout for TTS synthesis
const TTS_HTTP_TIMEOUT: Duration = Duration::from_secs(15);

/// Connect timeout
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);

/// Maximum number of characters to send to TTS to prevent runaway output
const MAX_TTS_CHARS: usize = 2048;

fn percent_encode(text: &str) -> String {
    let mut encoded = String::new();
    for byte in text.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            b' ' => encoded.push_str("%20"),
            _ => encoded.push_str(&format!("%{:02X}", byte)),
        }
    }
    encoded
}

pub async fn synthesize_speech(text: &str, voice: &str) -> Result<Vec<u8>, String> {
    if text.trim().is_empty() {
        return Ok(Vec::new());
    }

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

    // 1. Primary: Edge TTS Vercel Proxy (MS Neural Voices)
    if let Ok(bytes) = try_edge_tts_vercel(&client, &safe_text, voice).await {
        if !bytes.is_empty() {
            return Ok(bytes);
        }
    }

    // 2. Secondary: Edge TTS Deno Backup Proxy (MS Neural Voices)
    if let Ok(bytes) = try_edge_tts_backup(&client, &safe_text, voice).await {
        if !bytes.is_empty() {
            return Ok(bytes);
        }
    }

    // 3. Fallback: Google Translate Natural TTS (Guaranteed zero rate limit, ultra fast natural voice)
    let lang = if voice.starts_with("hi") || safe_text.contains(|c: char| ('\u{0900}'..='\u{097F}').contains(&c)) {
        "hi"
    } else {
        "en"
    };

    if let Ok(bytes) = try_google_translate_tts(&client, &safe_text, lang).await {
        if !bytes.is_empty() {
            return Ok(bytes);
        }
    }

    Err("All high-quality Neural TTS synthesis endpoints failed.".to_string())
}

async fn try_edge_tts_vercel(client: &Client, text: &str, voice: &str) -> Result<Vec<u8>, String> {
    let res = client
        .post("https://edge-tts-api.vercel.app/api/tts")
        .header("Content-Type", "application/json")
        .json(&json!({
            "text": text,
            "voice": voice
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let bytes = res.bytes().await.map_err(|e| e.to_string())?;
        Ok(bytes.to_vec())
    } else {
        Err(format!("HTTP {}", res.status()))
    }
}

async fn try_edge_tts_backup(client: &Client, text: &str, voice: &str) -> Result<Vec<u8>, String> {
    let res = client
        .post("https://edge-tts.deno.dev/api/tts")
        .header("Content-Type", "application/json")
        .json(&json!({
            "text": text,
            "voice": voice
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let bytes = res.bytes().await.map_err(|e| e.to_string())?;
        Ok(bytes.to_vec())
    } else {
        Err(format!("HTTP {}", res.status()))
    }
}

async fn try_google_translate_tts(client: &Client, text: &str, lang: &str) -> Result<Vec<u8>, String> {
    let encoded = percent_encode(text);
    let url = format!(
        "https://translate.google.com/translate_tts?ie=UTF-8&q={}&tl={}&client=tw-ob",
        encoded, lang
    );

    let res = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let bytes = res.bytes().await.map_err(|e| e.to_string())?;
        Ok(bytes.to_vec())
    } else {
        Err(format!("HTTP {}", res.status()))
    }
}
