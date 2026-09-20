use crate::instance_discovery::{discover_instances, get_instances_dir_path, mask_token, VSCodeInstance};
use crate::{log_debug, log_error, log_info, log_warn};
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::time::Duration;
use tokio::time::timeout;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

/// Timeout for the initial TCP + WebSocket handshake
const WS_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);

/// Timeout waiting for auth_response from the extension
const AUTH_TIMEOUT: Duration = Duration::from_secs(5);

/// Timeout waiting for a tool_response from the extension
const TOOL_TIMEOUT: Duration = Duration::from_secs(90);

pub async fn connect_and_execute_tool(
    target_pid: Option<u32>,
    manual_port: Option<u16>,
    manual_token: Option<String>,
    tool_name: &str,
    parameters: Value,
    confirmed: bool,
) -> Result<Value, String> {
    let (port, token, workspace) = if let (Some(p), Some(t)) = (manual_port, manual_token) {
        log_info!("STAGE 2 [Connect]: Using MANUAL FALLBACK connection (Port: {}, Token: {})", p, mask_token(&t));
        (p, t, Some("Manual Override Workspace".to_string()))
    } else {
        let instances = discover_instances();
        if instances.is_empty() {
            let path = get_instances_dir_path();
            let err_msg = format!("No active VS Code instances found in {}", path);
            log_error!("STAGE 2 [Connect]: {}", err_msg);
            return Err(err_msg);
        }

        let instance: &VSCodeInstance = if let Some(pid) = target_pid {
            instances
                .iter()
                .find(|i| i.pid == pid)
                .ok_or_else(|| {
                    let err = format!("VS Code instance with PID {} not found or unreachable.", pid);
                    log_error!("STAGE 2 [Connect]: {}", err);
                    err
                })?
        } else {
            &instances[0]
        };
        (instance.port, instance.token.clone(), instance.workspace.clone())
    };

    // Stage E: WebSocket URL formatting
    let url = format!("ws://127.0.0.1:{}", port);
    log_info!("STAGE 2 [Connect]: Connecting to WebSocket URL '{}' (Workspace: '{:?}')", url, workspace);

    // 1. Connect with timeout
    let ws_result = timeout(WS_CONNECT_TIMEOUT, connect_async(&url)).await;
    let (mut ws_stream, _) = match ws_result {
        Ok(Ok(conn)) => {
            log_info!("STAGE 2 [Connect]: TCP + WS handshake to '{}' ESTABLISHED.", url);
            conn
        }
        Ok(Err(e)) => {
            let err_msg = format!("WebSocket connection failed to {}: {}", url, e);
            log_error!("STAGE 2 [Connect]: {}", err_msg);
            return Err(err_msg);
        }
        Err(_) => {
            let err_msg = format!("WebSocket connection timed out after {}s — Port {} not responding.", WS_CONNECT_TIMEOUT.as_secs(), port);
            log_error!("STAGE 2 [Connect]: {}", err_msg);
            return Err(err_msg);
        }
    };

    // Stage F: Mandatory token authentication in first message
    let auth_msg = json!({
        "type": "auth_request",
        "token": token,
        "client_version": "0.1.0"
    });

    log_info!(
        "STAGE 2 [Handshake]: Sending auth_request token '{}' to extension...",
        mask_token(&token)
    );

    if let Err(e) = ws_stream.send(Message::Text(auth_msg.to_string())).await {
        let err_msg = format!("Failed to send auth_request message: {}", e);
        log_error!("STAGE 2 [Handshake]: {}", err_msg);
        return Err(err_msg);
    }

    // Await auth_response with timeout
    let auth_result = timeout(AUTH_TIMEOUT, ws_stream.next()).await;
    match auth_result {
        Ok(Some(Ok(Message::Text(txt)))) => {
            log_info!("STAGE 2 [Handshake]: Extension replied with auth payload: {}", txt);
            let auth_val: Value = serde_json::from_str(&txt).map_err(|e| e.to_string())?;
            if auth_val.get("success").and_then(|s| s.as_bool()) != Some(true) {
                let err_str = auth_val.get("error").and_then(|e| e.as_str()).unwrap_or("Invalid token rejected by extension");
                let err_msg = format!("Authentication rejected by extension on port {}: {}", port, err_str);
                log_error!("STAGE 2 [Handshake]: {}", err_msg);
                return Err(err_msg);
            }
            log_info!("STAGE 2 [Handshake]: Auth SUCCESSFUL! VS Code Extension is CONNECTED.");
        }
        Ok(Some(Err(e))) => {
            let err_msg = format!("WebSocket error during auth handshake: {}", e);
            log_error!("STAGE 2 [Handshake]: {}", err_msg);
            return Err(err_msg);
        }
        Ok(None) => {
            let err_msg = format!("VS Code extension closed connection during auth handshake (Close event).");
            log_error!("STAGE 2 [Handshake]: {}", err_msg);
            return Err(err_msg);
        }
        Ok(Some(Ok(other))) => {
            let err_msg = format!("Unexpected message type received during auth: {:?}", other);
            log_error!("STAGE 2 [Handshake]: {}", err_msg);
            return Err(err_msg);
        }
        Err(_) => {
            let err_msg = format!("Auth response timed out after {}s — extension did not reply.", AUTH_TIMEOUT.as_secs());
            log_error!("STAGE 2 [Handshake]: {}", err_msg);
            return Err(err_msg);
        }
    }

    // 4. Send tool_request
    let req_id = format!(
        "req_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()
    );
    let tool_msg = json!({
        "type": "tool_request",
        "request_id": req_id,
        "tool_name": tool_name,
        "parameters": parameters,
        "confirmed": confirmed
    });

    log_info!("STAGE 3 [Tool Exec]: Requesting tool '{}' (req_id: {})...", tool_name, req_id);

    ws_stream
        .send(Message::Text(tool_msg.to_string()))
        .await
        .map_err(|e| {
            let err = format!("Failed to send tool execution payload: {}", e);
            log_error!("STAGE 3 [Tool Exec]: {}", err);
            err
        })?;

    // 5. Receive tool_response with timeout
    let tool_result = timeout(TOOL_TIMEOUT, async {
        while let Some(msg_res) = ws_stream.next().await {
            let msg = match msg_res {
                Ok(m) => m,
                Err(e) => {
                    log_error!("STAGE 3 [Tool Exec]: WS Stream Error: {}", e);
                    return Err(format!("WebSocket stream error: {}", e));
                }
            };

            if let Message::Text(txt) = msg {
                log_debug!("STAGE 3 [Tool Exec]: Received raw text frame: {}", txt);
                let resp_val: Value = match serde_json::from_str(&txt) {
                    Ok(v) => v,
                    Err(e) => return Err(format!("Invalid JSON response: {}", e)),
                };

                let msg_type = resp_val.get("type").and_then(|t| t.as_str()).unwrap_or("");

                if msg_type == "tool_response" {
                    if resp_val.get("needsConfirmation").and_then(|c| c.as_bool()) == Some(true) {
                        let reason = resp_val
                            .get("reason")
                            .and_then(|r| r.as_str())
                            .unwrap_or("Action requires user confirmation.");
                        log_warn!("STAGE 3 [Tool Exec]: Tool '{}' requires user confirmation: {}", tool_name, reason);
                        return Err(format!("REQUIRES_CONFIRMATION: {}", reason));
                    }

                    if resp_val.get("success").and_then(|s| s.as_bool()) == Some(true) {
                        log_info!("STAGE 3 [Tool Exec]: Tool '{}' executed SUCCESSFULLY.", tool_name);
                        return Ok(resp_val.get("data").cloned().unwrap_or(json!({})));
                    } else {
                        let err_str = resp_val
                            .get("error")
                            .and_then(|e| e.as_str())
                            .unwrap_or("Tool execution failed");
                        log_error!("STAGE 3 [Tool Exec]: Tool '{}' returned error: {}", tool_name, err_str);
                        return Err(err_str.to_string());
                    }
                } else if msg_type == "error" {
                    let err_str = resp_val
                        .get("error")
                        .and_then(|e| e.as_str())
                        .unwrap_or("WebSocket error response from extension");
                    log_error!("STAGE 3 [Tool Exec]: Extension error: {}", err_str);
                    return Err(err_str.to_string());
                }
            } else if let Message::Close(frame) = msg {
                // Stage G: Close code and reason logging
                let code = frame.as_ref().map(|f| f.code.to_string()).unwrap_or_else(|| "None".to_string());
                let reason = frame.as_ref().map(|f| f.reason.to_string()).unwrap_or_else(|| "None".to_string());
                log_error!("STAGE 3 [Tool Exec]: WebSocket CLOSED by extension. Code: {}, Reason: '{}'", code, reason);
                return Err(format!("WebSocket closed by extension (Code: {}, Reason: '{}')", code, reason));
            }
        }
        Err("VS Code extension closed WebSocket before sending tool response.".to_string())
    })
    .await;

    match tool_result {
        Ok(res) => res,
        Err(timeout_err) => {
            let err = format!("Tool '{}' timed out after {}s: {:?}", tool_name, TOOL_TIMEOUT.as_secs(), timeout_err);
            log_error!("STAGE 3 [Tool Exec]: {}", err);
            Err(err)
        }
    }
}
