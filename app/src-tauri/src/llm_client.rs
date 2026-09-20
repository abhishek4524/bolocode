use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use tokio::time::sleep;

/// HTTP connect + read timeout for all LLM API calls
const LLM_HTTP_TIMEOUT: Duration = Duration::from_secs(60);

/// Timeout specifically for the Groq HTTP connection (connect phase)
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCallRequest {
    pub id: String,
    pub name: String,
    pub arguments: Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LlmChatResult {
    pub content: Option<String>,
    pub tool_calls: Vec<ToolCallRequest>,
    pub provider_used: String,
}

pub async fn chat_completion(
    messages: Vec<Value>,
    tools: Option<Vec<Value>>,
    groq_api_key: Option<&str>,
    openrouter_api_key: Option<&str>,
    primary_model: &str,
    fallback_model: &str,
) -> Result<LlmChatResult, String> {
    // Build reqwest client with timeouts
    let client = Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(LLM_HTTP_TIMEOUT)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let mut body_map = json!({
        "model": primary_model,
        "messages": messages,
    });

    if let Some(t_list) = tools.clone() {
        if !t_list.is_empty() {
            body_map["tools"] = json!(t_list);
            body_map["tool_choice"] = json!("auto");
        }
    }

    // 1. Try Groq (Primary LLM)
    if let Some(key) = groq_api_key {
        if !key.trim().is_empty() {
            // Attempt 1: Groq
            match send_groq_request(&client, key, &body_map).await {
                Ok(resp) => return Ok(resp),
                Err(e) => {
                    tracing::warn!("Groq attempt 1 failed: {}. Retrying once...", e);
                    sleep(Duration::from_millis(500)).await;
                    // Attempt 2: Groq Retry
                    match send_groq_request(&client, key, &body_map).await {
                        Ok(resp) => return Ok(resp),
                        Err(e2) => tracing::warn!("Groq attempt 2 failed: {}. Falling back to OpenRouter...", e2),
                    }
                }
            }
        }
    }

    // 2. Try OpenRouter (Fallback LLM)
    if let Some(key) = openrouter_api_key {
        if !key.trim().is_empty() {
            let mut fallback_body = body_map.clone();
            fallback_body["model"] = json!(fallback_model);

            let res = client
                .post("https://openrouter.ai/api/v1/chat/completions")
                .bearer_auth(key)
                .header("HTTP-Referer", "https://bolocode.app")
                .header("X-Title", "BoloCode Voice Agent")
                .json(&fallback_body)
                .send()
                .await
                .map_err(|e| {
                    if e.is_timeout() {
                        format!("OpenRouter request timed out after {}s.", LLM_HTTP_TIMEOUT.as_secs())
                    } else if e.is_connect() {
                        "OpenRouter connection failed — check your internet connection.".to_string()
                    } else {
                        format!("OpenRouter network error: {}", e)
                    }
                })?;

            if res.status().is_success() {
                let val: Value = res.json().await.map_err(|e| e.to_string())?;
                if let Some(mut parsed) = parse_llm_response(&val) {
                    parsed.provider_used = format!("OpenRouter ({})", fallback_model);
                    return Ok(parsed);
                }
            } else {
                let err_text = res.text().await.unwrap_or_default();
                return Err(format!("OpenRouter API Error: {}", err_text));
            }
        }
    }

    Err("All LLM providers (Groq primary and OpenRouter fallback) failed or are missing API keys. Please check Settings.".to_string())
}

async fn send_groq_request(client: &Client, key: &str, body: &Value) -> Result<LlmChatResult, String> {
    let res = client
        .post("https://api.groq.com/openai/v1/chat/completions")
        .bearer_auth(key)
        .json(body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                format!("Groq request timed out after {}s.", LLM_HTTP_TIMEOUT.as_secs())
            } else if e.is_connect() {
                "Groq connection failed — check your internet connection.".to_string()
            } else {
                format!("Groq network error: {}", e)
            }
        })?;

    if res.status().is_success() {
        let val: Value = res.json().await.map_err(|e| e.to_string())?;
        let model_used = body.get("model").and_then(|m| m.as_str()).unwrap_or("groq");
        if let Some(mut parsed) = parse_llm_response(&val) {
            parsed.provider_used = format!("Groq ({})", model_used);
            return Ok(parsed);
        }
        Err("Failed to parse Groq response structure".to_string())
    } else {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        Err(format!("Groq HTTP {}: {}", status, text))
    }
}

fn parse_llm_response(val: &Value) -> Option<LlmChatResult> {
    let message = val.get("choices")?.get(0)?.get("message")?;
    let content = message.get("content").and_then(|c| c.as_str()).map(|s| s.to_string());

    let mut tool_calls = Vec::new();
    if let Some(tc_arr) = message.get("tool_calls").and_then(|tc| tc.as_array()) {
        for tc in tc_arr {
            let id = tc.get("id")?.as_str()?.to_string();
            let name = tc.get("function")?.get("name")?.as_str()?.to_string();
            let args_str = tc.get("function")?.get("arguments")?.as_str()?;
            let arguments: Value = serde_json::from_str(args_str).unwrap_or(json!({}));

            tool_calls.push(ToolCallRequest { id, name, arguments });
        }
    }

    Some(LlmChatResult {
        content,
        tool_calls,
        provider_used: "LLM".to_string(),
    })
}
