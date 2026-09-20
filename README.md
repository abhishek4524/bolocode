<p align="center">
  <img src="branding/logo.png" alt="BoloCode Logo" width="120" />
</p>

# BoloCode — Voice-First Coding Agent for Visual Studio Code

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Platform: Windows | macOS | Linux](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()


**BoloCode** is a downloadable, open-source voice-first coding assistant desktop application for Windows, macOS, and Linux. It allows developers to control Visual Studio Code entirely hands-free using natural speech in **Hindi**, **English**, or **Hinglish**.

<!-- screenshot: main-ui -->
![BoloCode Voice Assistant UI Placeholder](docs/images/main_ui_placeholder.png)

---

## 🌟 Key Features

* 🗣️ **Multilingual Intent Understanding**: Speak in natural Hindi, English, or Hinglish (*"root me todo-app folder banao aur index.html create karo"*).
* ⚡ **High-Speed Voice Pipeline**: Groq Whisper STT + Groq Llama 3.3 70B primary LLM + OpenRouter fallback.
* 👂 **On-Device Wake Word Engine (Rustpotter)**:
  * Powered by `rustpotter` crate running in a background Rust thread using `cpal`.
  * **In-App Model Trainer**: Record 5-8 audio samples in the app to build your custom `.rpw` wake word model (*"Hey Bolo"*).
  * Auto-pauses during STT recording and TTS playback.
  * 2-second detection cooldown.
* 🔐 **Hardware-Level Security**:
  * API keys stored exclusively in the OS Keychain (`keyring` crate).
  * Local loopback WebSocket (`127.0.0.1`) with 256-bit token authentication and origin verification.
  * Strict `PathGuard` sandboxing to prevent path traversal outside workspace root.
  * Destructive action classifier requiring confirmation modal + voice confirmation for high-risk operations (`delete_path`, `rm -rf`, `sudo`, `git push --force`).
* 🔊 **Natural Spoken Feedback**: Neural Edge TTS (`hi-IN-SwaraNeural` default) with barge-in support.

---

## 🏗️ Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                                 TAURI V2 DESKTOP APP                              |
|                                                                                   |
|  +--------------------------------+       +------------------------------------+  |
|  |     React + TypeScript UI      |       |            Rust Backend            |  |
|  |  - Audio Visualizer & State    |       |  - Keychain Access (keyring)       |  |
|  |  - In-App .rpw Model Trainer  | <---> |  - Groq STT Client (Whisper)       |  |
|  |  - Confirmation Modal          |       |  - LLM Client (Groq/OpenRouter)    |  |
|  |  - Activity Log & Status       |       |  - Rustpotter Wake Word (cpal)     |  |
|  +--------------------------------+       +------------------------------------+  |
+---------------------------------------------------|-------------------------------+
                                                    |
                                          Local WebSocket (127.0.0.1)
                                          Token-Authenticated JSON Schema
                                                    |
+---------------------------------------------------|-------------------------------+
                                    VS CODE EXTENSION                              |
|  WebSocket Server (127.0.0.1) | PathGuard Sandbox | 12 Core Tool Handlers         |
+-----------------------------------------------------------------------------------+
```

---

## 🚀 Quick Start Guide

### 1. Download & Install Desktop App
Download the installer for your operating system from [GitHub Releases](https://github.com/abhishek4524/bolocode/releases):
* **Windows**: `BoloCode_0.1.0_x64-setup.exe` (NSIS) or `.msi`
* **macOS**: `BoloCode_0.1.0.dmg`
* **Linux**: `bolocode_0.1.0_amd64.AppImage` or `.deb`

### 2. Install VS Code Extension
Open VS Code and run the command:
```bash
code --install-extension bolocode-extension-0.1.0.vsix
```
*Alternatively, click the **"Install VS Code Extension"** button inside the BoloCode desktop app settings panel.*

### 3. Configure API Keys & Train Wake Word
1. Launch **BoloCode**.
2. Open **Settings (⚙️)** and enter your **Groq API Key** (and optional OpenRouter key).
3. To enable wake word (*"Hey Bolo"*):
   * Toggle **Enable Background Wake Word Listener** to `ON`.
   * Click **🎯 Train / Manage Wake Word (.rpw)**.
   * Record 5-8 samples of yourself saying *"Hey Bolo"*.
   * Click **🔨 Build Wake Word Model (.rpw)**.
4. Open a folder in VS Code, press `Ctrl+Shift+Space` (or say *"Hey Bolo"*), and start voice coding!

---

## 🛠️ Troubleshooting & FAQ

| Problem | Cause | Solution |
|---------|-------|----------|
| **"No active VS Code instances found"** | VS Code extension is not running or no folder is open. | Open a workspace folder in VS Code. Ensure BoloCode extension status bar says `BoloCode: Connected`. |
| **"VS Code CLI (`code`) not in PATH"** | The `code` binary is not linked in system PATH. | Open VS Code, press `Ctrl+Shift+P`, type `Shell Command: Install 'code' command in PATH`, and restart terminal. |
| **Wake Word listener fails to start** | No `.rpw` model trained yet. | Open Settings -> click **Train Wake Word (.rpw)** and record at least 3 samples to build your model. |
| **Groq STT Error: Invalid API Key** | Missing or incorrect Groq key. | Get a free API key at [console.groq.com](https://console.groq.com) and save it in Settings. |
| **Path OUT_OF_BOUNDS Error** | Target file is outside workspace root. | BoloCode sandboxes operations to the opened workspace root directory. Keep files within the workspace. |

---

## 📜 License

Apache License 2.0 — see [LICENSE](LICENSE) for details.
