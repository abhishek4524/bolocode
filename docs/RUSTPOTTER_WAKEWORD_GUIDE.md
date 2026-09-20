# Rustpotter Wake Word Guide & Architecture for BoloCode

BoloCode uses **Rustpotter**, an open-source, zero-cloud, privacy-first wake word engine running entirely inside the Rust desktop backend.

---

## Technical Architecture

```
[ Microphone (cpal) ] ---> [ 16kHz Mono f32 Resampler ] ---> [ Rustpotter Engine (Background Thread) ]
                                                                     |
                                                                (Match Score >= Sensitivity)
                                                                     |
                                                                     v
                                                          [ Event: wake-word-detected ]
                                                                     |
                                                                     v
                                                          [ Audio Chime + STT Flow ]
```

### Key Highlights:
1. **Direct Audio Stream (`cpal`)**: Rust owns the microphone stream in wake-word mode and streams chunks into `rustpotter.process_samples(...)`.
2. **In-App Training**: Users record 5 to 8 audio samples directly in the app. Rustpotter builds an on-device `.rpw` model using Dynamic Time Warping (DTW) feature extraction.
3. **Automatic Pause / Resume**: The wake word listener automatically pauses when STT recording is active or TTS is speaking to prevent self-triggering and microphone conflicts.
4. **2-Second Cooldown**: Prevents rapid double-triggering upon detection.
5. **Fallback Safety**: If no `.rpw` model exists or audio fails to open, the wake word listener deactivates gracefully. The app continues working 100% via the push-to-talk hotkey (`Ctrl+Shift+Space`).

---

## How to Train Your Wake Word ("Hey Bolo")

1. Open **Settings (⚙️)** in BoloCode.
2. Under **Wake Word Detection (Rustpotter)**, toggle **Enable Background Wake Word Listener** to `ON`.
3. Click **🎯 Train / Manage Wake Word (.rpw)**.
4. Record 5 to 8 samples of yourself clearly saying `"Hey Bolo"`.
5. Click **🔨 Build Wake Word Model (.rpw)**. Your trained model is saved at `~/.bolocode/wakeword.rpw`.
6. Click **Test Say Wake Word** to test your live match score and sensitivity threshold.
7. Click **Done** and **Save Settings**. Say `"Hey Bolo"` to trigger voice coding!
