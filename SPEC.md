# SPEC.md — BoloCode Specification

BoloCode is a downloadable voice-first coding agent for Windows, macOS, and Linux that controls Visual Studio Code via voice commands spoken in **Hindi**, **English**, or **Hinglish**.

---

## 1. Overview & Architecture

### Key Objectives
* **Voice-First Control**: Hands-free coding, navigation, search, file editing, and terminal commands using voice input.
* **Multilingual Nuance**: Full support for Hindi, English, and mixed Hinglish speech.
* **Local Security**: API keys stored in OS Keychain (`keyring`); extension communication restricted to local WebSocket (`127.0.0.1`) with auth token validation and workspace path sandboxing.
* **Short Speakable Feedback**: Agent responses are concise (1-2 sentences) in the language spoken by the user, formatted for Text-to-Speech (TTS).

### Architecture Components

```
+-----------------------------------------------------------------------------------+
|                                 TAURI V2 DESKTOP APP                              |
|                                                                                   |
|  +--------------------------------+       +------------------------------------+  |
|  |     React + TypeScript UI      |       |            Rust Backend            |  |
|  |  - Audio Visualizer & State    |       |  - Keychain Access (keyring)       |  |
|  |  - Settings & Config UI        | <---> |  - Groq STT Client (Whisper)       |  |
|  |  - Confirmation Modal          |       |  - LLM Client (Groq/OpenRouter)    |  |
|  |  - Activity Log & Status       |       |  - edge-tts Audio Synthesizer      |  |
|  +--------------------------------+       +------------------------------------+  |
+---------------------------------------------------|-------------------------------+
                                                    |
                                          Local WebSocket (127.0.0.1)
                                          Token-Authenticated JSON Schema
                                                    |
+---------------------------------------------------|-------------------------------+
|                                    VS CODE EXTENSION                              |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |  WebSocket Server (127.0.0.1)                                               |  |
|  |  - Auth Handshake Validator                                                 |  |
|  |  - Workspace Path Guard (Prevents path traversal outside root)              |  |
|  |  - Tool Executors (WorkspaceFS, Terminal, TextEditor, Commands)             |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

### End-to-End Voice Control Flow

1. **Trigger**: User presses hotkey (e.g., `Ctrl+Shift+Space`) or says custom wake word (*"Hey Bolo"*), detected on-device via the **Rustpotter** background engine (`cpal` mic capture with in-app `.rpw` model training).
2. **Audio Capture**: App records microphone input using Voice Activity Detection (VAD) to trim silence. The wake word listener automatically pauses during STT recording and TTS playback to prevent mic contention.
3. **Speech-to-Text (STT)**: Audio buffer is sent via Rust command to Groq Whisper API (`whisper-large-v3-turbo` by default).
4. **LLM Orchestration**:
   - Transcribed text sent to Groq (`llama-3.3-70b-versatile` by default).
   - Fallback automatically switches to OpenRouter if Groq fails or rate limits.
   - LLM decides tool calls or direct answer.
5. **Tool Execution**:
   - If tool call is needed, Tauri Rust backend sends JSON payload over WebSocket to VS Code Extension.
   - Extension validates path boundaries and security rules.
   - Dangerous actions trigger explicit confirmation prompt (UI + spoken).
   - Tool executes in VS Code; result returned via WebSocket.
6. **Response Generation & TTS**:
   - LLM produces short 1-2 sentence response matching input language.
   - Rust backend generates audio via `edge-tts`.
   - App plays audio and updates UI log.

---

## 2. Rules & Security Architecture

### Key Principles
1. **OS Keychain Storage**:
   * All API keys (Groq, OpenRouter) are saved directly in OS secure storage (`keyring` Rust crate — Windows Credential Manager, macOS Keychain, Linux Secret Service).
   * API keys are **never** stored in plaintext, config files, localStorage, or sent to the frontend.
2. **Backend Proxying**:
   * All network requests to Groq, OpenRouter, and TTS services are executed in the Rust Tauri backend.
3. **Local Loopback WebSocket & Auth**:
   * Extension WebSocket server binds strictly to `127.0.0.1`.
   * On extension startup, a random 256-bit cryptographically secure token is generated and shared with the Tauri app (via secure local handshake/port file).
   * Every WebSocket frame must include this auth token.
4. **Path Guard & Workspace Scope**:
   * All tool parameters referencing file paths are validated against the currently opened workspace root in VS Code.
   * Keyword `"root"` in user commands refers to the workspace root directory.
   * Access to paths outside the workspace is blocked unless explicitly authorized via high-risk confirmation.
5. **Dangerous Action Guardrails**:
   * Dangerous operations require dual confirmation (On-screen UI modal + Spoken prompt):
     * File/folder deletions (`delete_path`)
     * Destructive terminal commands (`rm -rf`, `git push`, `format`, `sudo`, `drop`, `chmod`, system commands)
     * Operations targeting files outside workspace root
6. **Configurable Models & Settings**:
   * No API endpoints or model names hardcoded.
   * Model configurations stored in user preferences:
     * **Groq STT Model**: Default `whisper-large-v3-turbo` (configurable to `whisper-large-v3`).
     * **Primary LLM**: Default `llama-3.3-70b-versatile` (configurable).
     * **Fallback LLM**: Default OpenRouter `meta-llama/llama-3.3-70b-instruct` (configurable).
     * **TTS Voice**: `hi-IN-SwaraNeural` / `hi-IN-MadhurNeural` (Hindi/Hinglish), `en-US-AvaNeural` (English).

---

## 3. Tool Specifications

The agent supports **12 core tools** executed inside VS Code:

| Tool Name | Parameters Schema | Description | Safety Level |
|---|---|---|---|
| `create_folder` | `{ "path": string }` | Creates directory inside workspace | Normal |
| `create_file` | `{ "path": string, "content"?: string }` | Creates empty or initial file | Normal |
| `write_file` | `{ "path": string, "content": string }` | Overwrites entire file content | Normal |
| `edit_file` | `{ "path": string, "search": string, "replace": string }` | Replaces target substring in file | Normal |
| `read_file` | `{ "path": string, "start_line"?: int, "end_line"?: int }` | Reads file content with optional line window | Safe |
| `list_dir` | `{ "path"?: string }` | Lists directory files and subfolders | Safe |
| `delete_path` | `{ "path": string }` | Deletes file or directory | **Dangerous (Requires Confirmation)** |
| `move_path` | `{ "from_path": string, "to_path": string }` | Renames or moves a file/folder | Normal |
| `open_file` | `{ "path": string, "line"?: int }` | Opens file in active editor tab | Safe |
| `get_active_file` | `{}` | Returns path and line count of active file | Safe |
| `search_in_files` | `{ "query": string, "path"?: string }` | Performs text search across workspace | Safe |
| `run_command` | `{ "command": string }` | Runs shell command in integrated terminal | **Dangerous if destructive** |

---

## 4. Folder Structure

```
BoloCode/
├── SPEC.md
├── package.json                   # Root workspace config (npm workspaces / pnpm)
├── app/                           # Tauri v2 Desktop App
│   ├── src-tauri/
│   │   ├── Cargo.toml
│   │   ├── tauri.conf.json
│   │   └── src/
│   │       ├── main.rs
│   │       ├── lib.rs
│   │       ├── keychain.rs        # OS Keyring manager
│   │       ├── stt_groq.rs        # Groq Whisper API client
│   │       ├── llm_client.rs      # Groq + OpenRouter LLM client & failover
│   │       ├── tts_engine.rs      # edge-tts Rust wrapper
│   │       ├── ws_client.rs       # Tauri -> VS Code extension WS client
│   │       ├── config.rs          # Settings & model preferences
│   │       └── commands.rs        # Tauri IPC commands for React UI
│   ├── src/                       # React + TS + Vite Frontend
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── AudioVisualizer.tsx
│   │   │   ├── SettingsModal.tsx
│   │   │   ├── ConfirmationModal.tsx
│   │   │   ├── CommandHistory.tsx
│   │   │   └── StatusIndicator.tsx
│   │   ├── hooks/
│   │   │   ├── useVoiceRecorder.ts
│   │   │   └── useAgentState.ts
│   │   └── services/
│   │       └── tauriApi.ts
│   ├── package.json
│   └── vite.config.ts
└── extension/                     # VS Code Extension
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── extension.ts           # Extension entrypoint & activation
        ├── wsServer.ts            # WebSocket server (127.0.0.1) & token auth
        ├── pathGuard.ts           # Workspace path boundary checker
        ├── tools/
        │   ├── index.ts           # Tool registry & router
        │   ├── fileOps.ts         # create, read, write, edit, delete, move
        │   ├── editorOps.ts       # open, active file info
        │   ├── searchOps.ts       # search in files
        │   └── terminalOps.ts     # run_command
        └── utils/
            └── security.ts        # Dangerous action classifier
```

---

## 5. Message Protocol (JSON Schema)

Communication between Tauri App (Client) and VS Code Extension (Server) over WebSocket (`127.0.0.1:<port>`).

### Handshake & Authentication

#### 1. Authentication Request (Client -> Server)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "type": { "type": "string", "enum": ["auth_request"] },
    "token": { "type": "string" },
    "client_version": { "type": "string" }
  },
  "required": ["type", "token", "client_version"]
}
```

#### 2. Authentication Response (Server -> Client)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "type": { "type": "string", "enum": ["auth_response"] },
    "success": { "type": "boolean" },
    "workspace_root": { "type": "string" },
    "error": { "type": "string" }
  },
  "required": ["type", "success"]
}
```

---

### Tool Execution

#### 3. Tool Execution Request (Client -> Server)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "type": { "type": "string", "enum": ["tool_request"] },
    "request_id": { "type": "string" },
    "tool_name": { "type": "string" },
    "parameters": { "type": "object" },
    "user_confirmed": { "type": "boolean" }
  },
  "required": ["type", "request_id", "tool_name", "parameters"]
}
```

#### 4. Tool Execution Response (Server -> Client)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "type": { "type": "string", "enum": ["tool_response"] },
    "request_id": { "type": "string" },
    "success": { "type": "boolean" },
    "data": { "type": "object" },
    "error": { "type": "string" }
  },
  "required": ["type", "request_id", "success"]
}
```

---

### Sync & Heartbeat

#### 5. Ping / Pong
```json
{ "type": "ping" }
{ "type": "pong" }
```

---

## 6. Error-Handling Rules

1. **STT Failures / Empty Audio**:
   * If VAD detects silence or STT returns empty string, speak *"Aapki aawaz nahi sun paya. Kripya dubara boliye."* / *"Could not hear you. Please speak again."*
2. **LLM Primary Failover**:
   * If Groq API request times out or returns HTTP 429/5xx, switch immediately to OpenRouter fallback LLM. Log error to app debug view.
3. **VS Code Disconnect**:
   * If WebSocket disconnects, retry with exponential backoff (1s, 2s, 4s, max 10s).
   * App UI displays "VS Code Disconnected" status badge.
4. **Path Traversal Violation**:
   * Extension rejects any operation outside workspace root with error `OUT_OF_BOUNDS`.
   * LLM informs user in spoken reply: *"Yeh file workspace root ke bahar hai."*
5. **Tool Execution Errors**:
   * Return exact error string in `tool_response`.
   * LLM receives error context and formulates user-friendly correction or explanation.
6. **Dangerous Action Rejection**:
   * If user rejects confirmation modal or says "nahi" / "cancel", execution aborts safely with no changes made.

---

## 7. Phased Build Plan

* **Phase 1: Project Architecture & Specification Setup**
  * Create `SPEC.md` and repository directory structure for `/app` and `/extension`.
  * Establish workspace configuration (`package.json`, build scripts).

* **Phase 2: VS Code Extension Development**
  * Implement WebSocket server (`127.0.0.1`) with token validation.
  * Build `pathGuard` workspace path validation.
  * Implement 12 core tool handlers (`fileOps`, `editorOps`, `searchOps`, `terminalOps`).

* **Phase 3: Tauri v2 App Backend (Rust)**
  * Setup Tauri v2 backend with `keyring` integration for secure credential storage.
  * Build Groq STT client module (`whisper-large-v3-turbo`).
  * Build LLM client module (Groq `llama-3.3-70b-versatile` + OpenRouter fallback).
  * Integrate `edge-tts` synthesizer for spoken feedback.
  * Implement WebSocket client to communicate with extension.

* **Phase 4: Audio Capture & Voice Pipeline**
  * Integrate web audio recording with VAD in React frontend.
  * Implement hotkey listener (`Ctrl+Space`) and wake-word detector ("Hey Bolo").
  * Link voice recording -> STT -> LLM -> Tool call -> TTS loop.

* **Phase 5: Safety Guardrails & User Interface**
  * Build React UI: audio visualizer, status badge, setting panel (API keys & model choices).
  * Build confirmation modal UI and spoken confirmation prompt logic for dangerous actions.

* **Phase 6: End-to-End Testing & Refinement**
  * Verify Hindi, English, and Hinglish intent handling.
  * Test network failure and OpenRouter fallback.
  * Packaging and release build setup for Windows, Mac, and Linux.
