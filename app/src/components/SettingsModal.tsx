import React, { useEffect, useState } from 'react';
import { AppConfig, tauriApi } from '../services/tauriApi';
import { WakeWordTrainerModal } from './WakeWordTrainerModal';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [groqKey, setGroqKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [showTrainer, setShowTrainer] = useState(false);

  const [config, setConfig] = useState<AppConfig>({
    groq_stt_model: 'whisper-large-v3-turbo',
    primary_llm_model: 'llama-3.3-70b-versatile',
    fallback_llm_model: 'meta-llama/llama-3.3-70b-instruct',
    tts_voice: 'hi-IN-SwaraNeural',
    hotkey: 'Ctrl+Shift+Space',
    microphone_device: 'default',
    wake_word_enabled: false,
    wake_word_sensitivity: 0.50,
    custom_wakeword_path: '',
    onboarding_done: false,
  });

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [gKey, orKey, cfg] = await Promise.all([
          tauriApi.getApiKey('groq'),
          tauriApi.getApiKey('openrouter'),
          tauriApi.getAppSettings(),
        ]);

        if (gKey) setGroqKey(gKey);
        if (orKey) setOpenrouterKey(orKey);
        if (cfg) setConfig(cfg);

        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setMicrophones(devices.filter((d) => d.kind === 'audioinput'));
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSave = async () => {
    try {
      await Promise.all([
        tauriApi.saveApiKey('groq', groqKey),
        tauriApi.saveApiKey('openrouter', openrouterKey),
        tauriApi.saveAppSettings(config),
      ]);
      setMessage('Settings & Keychain API Keys saved successfully!');
      setTimeout(() => {
        setMessage('');
        onClose();
      }, 1200);
    } catch (err: any) {
      setMessage(`Error saving settings: ${err.message || err}`);
    }
  };

  if (loading) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
      >
        <div
          style={{
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '580px',
            width: '92%',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '1px solid #334155',
          }}
        >
          <h2 style={{ fontSize: '18px', color: '#f8fafc', marginBottom: '16px' }}>
            ⚙️ BoloCode Settings & Configuration
          </h2>

          {message && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: '#0284c7',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {message}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Keychain Keys */}
            <div
              style={{
                backgroundColor: '#0f172a',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #334155',
              }}
            >
              <h3
                style={{
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  color: '#38bdf8',
                  marginBottom: '8px',
                }}
              >
                🔐 OS Keychain Stored API Keys
              </h3>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                  Groq API Key (Primary STT & LLM)
                </label>
                <input
                  type="password"
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                  OpenRouter API Key (Fallback LLM)
                </label>
                <input
                  type="password"
                  value={openrouterKey}
                  onChange={(e) => setOpenrouterKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>

            {/* Wake Word Settings Section — Rustpotter */}
            <div
              style={{
                backgroundColor: '#0f172a',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #334155',
              }}
            >
              <h3
                style={{
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  color: '#f59e0b',
                  marginBottom: '8px',
                }}
              >
                👂 Wake Word Detection (Rustpotter Backend)
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  id="wake_word_toggle"
                  checked={config.wake_word_enabled}
                  onChange={(e) => setConfig({ ...config, wake_word_enabled: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label
                  htmlFor="wake_word_toggle"
                  style={{ fontSize: '13px', color: '#f8fafc', cursor: 'pointer', fontWeight: 500 }}
                >
                  Enable Background Wake Word Listener (Default: Off)
                </label>
              </div>

              {config.wake_word_enabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                      <span>Detection Sensitivity Threshold</span>
                      <span>{(config.wake_word_sensitivity * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.10"
                      max="0.90"
                      step="0.05"
                      value={config.wake_word_sensitivity}
                      onChange={(e) =>
                        setConfig({ ...config, wake_word_sensitivity: parseFloat(e.target.value) })
                      }
                      style={{ width: '100%', cursor: 'pointer' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                      Custom Model File Path (.rpw)
                    </label>
                    <input
                      type="text"
                      value={config.custom_wakeword_path}
                      onChange={(e) => setConfig({ ...config, custom_wakeword_path: e.target.value })}
                      placeholder="Leave empty for default (~/.bolocode/wakeword.rpw)"
                      style={{
                        width: '100%',
                        padding: '8px',
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: '6px',
                        color: '#f8fafc',
                        fontSize: '13px',
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowTrainer(true)}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#d97706',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    🎯 Train / Manage Wake Word (.rpw)
                  </button>
                </div>
              )}
            </div>

            {/* Model Names */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '4px' }}>
                Speech-to-Text Model (Groq Whisper)
              </label>
              <input
                type="text"
                value={config.groq_stt_model}
                onChange={(e) => setConfig({ ...config, groq_stt_model: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '13px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '4px' }}>
                Primary LLM Model (Groq)
              </label>
              <input
                type="text"
                value={config.primary_llm_model}
                onChange={(e) => setConfig({ ...config, primary_llm_model: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '13px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '4px' }}>
                Fallback LLM Model (OpenRouter)
              </label>
              <input
                type="text"
                value={config.fallback_llm_model}
                onChange={(e) => setConfig({ ...config, fallback_llm_model: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '13px',
                }}
              />
            </div>

            {/* TTS Voice */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '4px' }}>
                TTS Voice Accent
              </label>
              <select
                value={config.tts_voice}
                onChange={(e) => setConfig({ ...config, tts_voice: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '13px',
                }}
              >
                <option value="hi-IN-SwaraNeural">Hindi / Hinglish (Swara - Female)</option>
                <option value="hi-IN-MadhurNeural">Hindi / Hinglish (Madhur - Male)</option>
                <option value="en-US-AvaNeural">English (Ava - Female)</option>
                <option value="en-US-AndrewNeural">English (Andrew - Male)</option>
              </select>
            </div>

            {/* Hotkey */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '4px' }}>
                Push-to-Talk Hotkey
              </label>
              <input
                type="text"
                value={config.hotkey}
                onChange={(e) => setConfig({ ...config, hotkey: e.target.value })}
                placeholder="Ctrl+Shift+Space"
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '13px',
                }}
              />
            </div>

            {/* Microphone Picker */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '4px' }}>
                Microphone Device
              </label>
              <select
                value={config.microphone_device}
                onChange={(e) => setConfig({ ...config, microphone_device: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '13px',
                }}
              >
                <option value="default">Default Input Device</option>
                {microphones.map((mic) => (
                  <option key={mic.deviceId} value={mic.deviceId}>
                    {mic.label || `Microphone ${mic.deviceId.substring(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                backgroundColor: '#475569',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 16px',
                backgroundColor: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>

      {showTrainer && (
        <WakeWordTrainerModal
          sensitivity={config.wake_word_sensitivity}
          onClose={() => setShowTrainer(false)}
        />
      )}
    </>
  );
};
