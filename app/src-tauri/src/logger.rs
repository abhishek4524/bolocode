use std::fs::{OpenOptions, create_dir_all};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use chrono::Local;
use lazy_static::lazy_static;

fn get_app_dir() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(|h| PathBuf::from(h).join(".bolocode"))
}

lazy_static! {
    static ref LOG_MUTEX: Mutex<()> = Mutex::new(());
}

pub fn log_message(level: &str, msg: &str) {
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
    let formatted_line = format!("[{}] [{}] {}", timestamp, level, msg);
    
    // Always print to stdout
    println!("{}", formatted_line);

    // Append to ~/.bolocode/app.log safely
    if let Ok(_guard) = LOG_MUTEX.lock() {
        if let Some(app_dir) = get_app_dir() {
            let _ = create_dir_all(&app_dir);
            let log_file = app_dir.join("app.log");
            if let Ok(mut file) = OpenOptions::new()
                .create(true)
                .append(true)
                .open(log_file)
            {
                let _ = writeln!(file, "{}", formatted_line);
            }
        }
    }
}

#[macro_export]
macro_rules! log_info {
    ($($arg:tt)*) => {
        $crate::logger::log_message("INFO", &format!($($arg)*));
    };
}

#[macro_export]
macro_rules! log_warn {
    ($($arg:tt)*) => {
        $crate::logger::log_message("WARN", &format!($($arg)*));
    };
}

#[macro_export]
macro_rules! log_error {
    ($($arg:tt)*) => {
        $crate::logger::log_message("ERROR", &format!($($arg)*));
    };
}

#[macro_export]
macro_rules! log_debug {
    ($($arg:tt)*) => {
        $crate::logger::log_message("DEBUG", &format!($($arg)*));
    };
}

pub fn read_app_logs(max_lines: usize) -> Vec<String> {
    if let Some(app_dir) = get_app_dir() {
        let log_file = app_dir.join("app.log");
        if log_file.exists() {
            if let Ok(content) = std::fs::read_to_string(log_file) {
                let lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
                if lines.len() > max_lines {
                    return lines[lines.len() - max_lines..].to_vec();
                }
                return lines;
            }
        }
    }
    vec![]
}
