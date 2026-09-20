pub mod commands;
pub mod config;
pub mod instance_discovery;
pub mod keychain;
pub mod llm_client;
pub mod logger;
pub mod stt_groq;
pub mod tts_engine;
pub mod wakeword_engine;
pub mod ws_client;

use commands::*;
use config::load_config;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let cfg = load_config();
            if cfg.wake_word_enabled {
                let handle = app.handle().clone();
                let custom_path = if !cfg.custom_wakeword_path.is_empty() {
                    Some(cfg.custom_wakeword_path)
                } else {
                    None
                };
                let res = wakeword_engine::start_wakeword_listener(
                    handle,
                    cfg.wake_word_sensitivity,
                    custom_path,
                );
                if let Err(e) = res {
                    tracing::warn!("Wake word listener failed to start on boot: {}", e);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_instances,
            check_connection_status,
            connect_manual,
            get_app_logs,
            save_api_key,
            get_api_key_cmd,
            get_app_settings,
            save_app_settings,
            call_tool,
            llm_chat,
            stt_transcribe,
            tts_speak,
            start_wakeword_cmd,
            stop_wakeword_cmd,
            set_wakeword_paused_cmd,
            save_wakeword_sample_cmd,
            get_wakeword_sample_count_cmd,
            clear_wakeword_samples_cmd,
            build_wakeword_model_cmd,
            test_wakeword_audio_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
