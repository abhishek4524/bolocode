# Changelog

All notable changes to the **BoloCode VS Code Extension** will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.1.0] — 2026-09-20

### Added
- Local WebSocket server (`127.0.0.1`) with dynamic port allocation
- 256-bit cryptographically secure per-session authentication token
- **12 core tools**: `create_folder`, `create_file`, `write_file`, `edit_file`, `read_file`, `list_dir`, `delete_path`, `move_path`, `open_file`, `get_active_file`, `search_in_files`, `run_command`
- `edit_file` supports both **search-and-replace** and **line-number-based** insertion
- `PathGuard` — workspace-scoped path sandboxing, rejects all out-of-bounds paths
- `SecurityClassifier` — flags high-risk operations for user confirmation before execution
- Status bar item with codicon states: `$(mic)` (connected), `$(debug-disconnect)` (offline), `$(sync~spin)` (busy)
- Instance file (`~/.bolocode/instances/<PID>.json`) for zero-config auto-discovery by the desktop app
- `lastFocused` timestamp updated whenever VS Code window gains focus (most recently focused VS Code is auto-selected by the app)
- Extension icon (128×128 PNG), gallery banner, categories, keywords
- Full `README.md` with tool reference, security model, and troubleshooting guide
