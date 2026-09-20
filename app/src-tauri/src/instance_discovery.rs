use crate::{log_error, log_info, log_warn};
use serde::{Deserialize, Serialize};
use std::fs;
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct VSCodeInstance {
    #[serde(default)]
    pub pid: u32,
    pub port: u16,
    pub token: String,
    pub workspace: Option<String>,
    #[serde(rename = "lastFocused")]
    pub last_focused: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_reachable: Option<bool>,
}

fn get_instances_dir() -> Option<PathBuf> {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)?;

    Some(home.join(".bolocode").join("instances"))
}

pub fn mask_token(token: &str) -> String {
    if token.len() <= 8 {
        "***".to_string()
    } else {
        format!("{}...{}", &token[..4], &token[token.len() - 4..])
    }
}

pub fn is_port_reachable(port: u16, timeout_ms: u64) -> bool {
    let addr: SocketAddr = match format!("127.0.0.1:{}", port).parse() {
        Ok(a) => a,
        Err(_) => return false,
    };

    TcpStream::connect_timeout(&addr, Duration::from_millis(timeout_ms)).is_ok()
}

pub fn discover_instances() -> Vec<VSCodeInstance> {
    let dir = match get_instances_dir() {
        Some(d) => d,
        None => {
            log_error!("STAGE 1 [Discovery]: Failed to resolve USERPROFILE/HOME directory.");
            return vec![];
        }
    };

    let dir_str = dir.to_string_lossy().to_string();
    log_info!("STAGE 1 [Discovery]: Scanning instance folder: {}", dir_str);

    if !dir.exists() {
        log_warn!(
            "STAGE 1 [Discovery]: Instance folder does not exist yet at {}",
            dir_str
        );
        return vec![];
    }

    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(err) => {
            log_error!(
                "STAGE 1 [Discovery]: Failed to read instance directory {}: {}",
                dir_str,
                err
            );
            return vec![];
        }
    };

    let mut found_count = 0;
    let mut instances = vec![];

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
            found_count += 1;
            let file_name = path.file_name().unwrap_or_default().to_string_lossy();

            match fs::read_to_string(&path) {
                Ok(content) => match serde_json::from_str::<VSCodeInstance>(&content) {
                    Ok(mut inst) => {
                        if inst.pid == 0 {
                            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                                inst.pid = stem.parse::<u32>().unwrap_or(0);
                            }
                        }

                        let masked = mask_token(&inst.token);
                        log_info!(
                            "STAGE 1 [Discovery]: Found instance file '{}' -> PID: {}, Port: {}, Workspace: '{:?}', Token: '{}', lastFocused: '{:?}'",
                            file_name,
                            inst.pid,
                            inst.port,
                            inst.workspace,
                            masked,
                            inst.last_focused
                        );

                        // Stage C: TCP Reachability Probe
                        log_info!(
                            "STAGE 1 [Discovery]: Testing TCP connectivity to 127.0.0.1:{}...",
                            inst.port
                        );
                        if is_port_reachable(inst.port, 200) {
                            log_info!(
                                "STAGE 1 [Discovery]: TCP connection to 127.0.0.1:{} SUCCESS! Instance is ACTIVE.",
                                inst.port
                            );
                            inst.is_reachable = Some(true);
                            instances.push(inst);
                        } else {
                            log_warn!(
                                "STAGE 1 [Discovery]: TCP connection to 127.0.0.1:{} FAILED (Port unreachable/dead process). Deleting stale instance file '{}'.",
                                inst.port,
                                file_name
                            );
                            if let Err(del_err) = fs::remove_file(&path) {
                                log_error!(
                                    "STAGE 1 [Discovery]: Failed to delete stale file '{}': {}",
                                    file_name,
                                    del_err
                                );
                            } else {
                                log_info!(
                                    "STAGE 1 [Discovery]: Successfully cleaned up stale file '{}'.",
                                    file_name
                                );
                            }
                        }
                    }
                    Err(parse_err) => {
                        log_error!(
                            "STAGE 1 [Discovery]: Failed to parse instance file '{}': {}. Deleting corrupt file.",
                            file_name,
                            parse_err
                        );
                        let _ = fs::remove_file(&path);
                    }
                },
                Err(read_err) => {
                    log_error!(
                        "STAGE 1 [Discovery]: Failed to read instance file '{}': {}",
                        file_name,
                        read_err
                    );
                }
            }
        }
    }

    log_info!(
        "STAGE 1 [Discovery]: Scanned {} total .json files in {}. Found {} active, reachable instance(s).",
        found_count,
        dir_str,
        instances.len()
    );

    // Stage D: Sort by last_focused descending (most recent first)
    instances.sort_by(|a, b| {
        let a_time = a.last_focused.as_deref().unwrap_or("");
        let b_time = b.last_focused.as_deref().unwrap_or("");
        b_time.cmp(a_time)
    });

    if let Some(selected) = instances.first() {
        log_info!(
            "STAGE 1 [Discovery]: Selected primary instance PID: {}, Port: {}, Workspace: '{:?}' (most recent lastFocused)",
            selected.pid,
            selected.port,
            selected.workspace
        );
    } else {
        log_warn!("STAGE 1 [Discovery]: No active VS Code instances currently reachable.");
    }

    instances
}

pub fn get_primary_instance() -> Option<VSCodeInstance> {
    let list = discover_instances();
    list.into_iter().next()
}

pub fn get_instances_dir_path() -> String {
    get_instances_dir()
        .map(|d| d.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use std::net::TcpListener;

    #[test]
    fn test_mask_token() {
        assert_eq!(mask_token("12345678"), "***");
        assert_eq!(
            mask_token("0982df1bf5d443b9313ccb999918aba328cad38fe74bb1dc07697524238895c1"),
            "0982...95c1"
        );
    }

    #[test]
    fn test_is_port_reachable() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("Should bind to free port");
        let port = listener.local_addr().unwrap().port();

        assert!(is_port_reachable(port, 500));
        drop(listener);
        assert!(!is_port_reachable(port, 100));
    }

    #[test]
    fn test_discovery_flow_with_mock_files() {
        let temp_dir = std::env::temp_dir().join("bolocode_test_instances");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        // 1. Create a dummy TCP listener for active instance
        let listener = TcpListener::bind("127.0.0.1:0").expect("Should bind to free port");
        let active_port = listener.local_addr().unwrap().port();

        // Write valid active instance file
        let active_file = temp_dir.join("1001.json");
        let active_content = format!(
            r#"{{ "port": {}, "token": "test_active_token_1234567890", "workspace": "/test/active", "lastFocused": "2026-09-20T10:00:00Z" }}"#,
            active_port
        );
        File::create(&active_file)
            .unwrap()
            .write_all(active_content.as_bytes())
            .unwrap();

        // Write stale instance file (port 59999 - closed)
        let stale_file = temp_dir.join("1002.json");
        let stale_content = r#"{ "port": 59999, "token": "test_stale_token_1234567890", "workspace": "/test/stale", "lastFocused": "2026-09-19T10:00:00Z" }"#;
        File::create(&stale_file)
            .unwrap()
            .write_all(stale_content.as_bytes())
            .unwrap();

        // Write corrupt file
        let corrupt_file = temp_dir.join("1003.json");
        File::create(&corrupt_file)
            .unwrap()
            .write_all(b"invalid json content")
            .unwrap();

        // Override get_instances_dir logic or test parse directly
        let active_inst: VSCodeInstance =
            serde_json::from_str(&fs::read_to_string(&active_file).unwrap()).unwrap();
        assert_eq!(active_inst.port, active_port);
        assert!(is_port_reachable(active_inst.port, 200));

        let stale_inst: VSCodeInstance =
            serde_json::from_str(&fs::read_to_string(&stale_file).unwrap()).unwrap();
        assert!(!is_port_reachable(stale_inst.port, 100));

        drop(listener);
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
