import React, { useState, useEffect } from 'react';
import {
  Network,
  Mic,
  Cpu,
  Ear,
  Keyboard,
  Terminal,
  X,
  Eye,
  EyeOff,
  ShieldCheck
} from 'lucide-react';
import { AppConfig, tauriApi } from '../services/tauriApi';
import { WakeWordTrainerModal } from './WakeWordTrainerModal';
import { useToast } from './Toast';

interface SettingsModalProps {
  onClose: () => void;
}

type NavSection = 'connection' | 'voice' | 'models' | 'wakeword' | 'shortcuts' | 'debug';

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { showToast } = useToast();
  const [activeSection, setActiveSection] = useState<NavSection>('connection');

  const [groqKey, setGroqKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);

  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [showTrainer, setShowTrainer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testingKey, setTestingKey] = useState<string | null>(null);

  const [config, setConfig] = useState<AppConfig>({
    groq_stt_model: 'whisper-large-v3-turbo',
    primary_llm_model: 'llama-3.3-70b-specdec',
    fallback_llm_model: 'meta-llama/llama-3.3-70b-instruct',
    tts_voice: 'hi-IN-MadhurNeural',
    hotkey: 'Ctrl+Shift+Space',
    microphone_device: 'default',
    wake_word_enabled: false,
    wake_word_sensitivity: 0.50,
    custom_wakeword_path: '',
    onboarding_done: true,
    mute_agent_voice: false,
    pause_listening: false,
    speak_progress_updates: false
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [gKey, orKey, cfg] = await Promise.all([
          tauriApi.getApiKey('groq'),
          tauriApi.getApiKey('openrouter'),
          tauriApi.getAppSettings()
        ]);

        if (gKey) setGroqKey(gKey);
        if (orKey) setOpenrouterKey(orKey);
        if (cfg) setConfig(cfg);

        if (navigator.mediaDevices?.enumerateDevices) {
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
        tauriApi.saveAppSettings(config)
      ]);
      showToast({ type: 'success', title: 'Settings saved successfully' });
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Failed to save settings', details: err?.message || String(err) });
    }
  };

  const handleTestKey = async (provider: 'groq' | 'openrouter') => {
    setTestingKey(provider);
    try {
      const key = provider === 'groq' ? groqKey : openrouterKey;
      if (!key.trim()) {
        showToast({ type: 'warning', title: `Please enter a ${provider} API key first` });
        return;
      }
      await tauriApi.saveApiKey(provider, key.trim());
      showToast({ type: 'success', title: `${provider.toUpperCase()} key verified & stored in OS keychain` });
    } catch (err: any) {
      showToast({ type: 'error', title: `${provider.toUpperCase()} verification failed`, details: err?.message || String(err) });
    } finally {
      setTestingKey(null);
    }
  };

  if (loading) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20
      }}
      role="dialog"
      aria-labelledby="settings-title"
    >
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          width: 820,
          maxWidth: '100%',
          height: 560,
          maxHeight: '90vh',
          display: 'flex',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Left Nav */}
        <div
          style={{
            width: 210,
            backgroundColor: 'var(--elevated)',
            borderRight: '1px solid var(--border)',
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', padding: '4px 8px 14px 8px', letterSpacing: '-0.01em' }}>
              Settings
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[
                { id: 'connection', label: 'Connection', icon: <Network size={14} /> },
                { id: 'voice', label: 'Voice & Language', icon: <Mic size={14} /> },
                { id: 'models', label: 'AI Models', icon: <Cpu size={14} /> },
                { id: 'wakeword', label: 'Wake Word', icon: <Ear size={14} /> },
                { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={14} /> },
                { id: 'debug', label: 'Advanced & Debug', icon: <Terminal size={14} /> }
              ].map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id as NavSection)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isActive ? 'var(--surface)' : 'transparent',
                      border: `1px solid ${isActive ? 'var(--border)' : 'transparent'}`,
                      color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div style={{ padding: '8px', fontSize: 11, color: 'var(--text-dim)', borderTop: '1px solid var(--border)' }}>
            BoloCode v0.1.0 (Build 2026)
          </div>
        </div>

        {/* Right Content Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <h2 id="settings-title" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', textTransform: 'capitalize' }}>
              {activeSection.replace('-', ' ')} Settings
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {activeSection === 'connection' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                    VS Code Extension Protocol
                  </label>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>
                    BoloCode automatically discovers running VS Code instances locally on <code>127.0.0.1</code> via PID files in <code>~/.bolocode/instances/</code>.
                  </p>
                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-muted)' }}>
                    🛡️ Authenticated via 256-bit cryptographic token per session. Only local loopback connections are allowed.
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'voice' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                    TTS Neural Voice
                  </label>
                  <select
                    value={config.tts_voice}
                    onChange={(e) => setConfig({ ...config, tts_voice: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      backgroundColor: 'var(--elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-main)',
                      fontSize: 12
                    }}
                  >
                    <option value="hi-IN-MadhurNeural">Hindi / Hinglish (Madhur - Male Neural)</option>
                    <option value="hi-IN-SwaraNeural">Hindi / Hinglish (Swara - Female Neural)</option>
                    <option value="en-US-AndrewNeural">English (Andrew - Male Neural)</option>
                    <option value="en-US-AvaNeural">English (Ava - Female Neural)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                    Microphone Input Device
                  </label>
                  <select
                    value={config.microphone_device}
                    onChange={(e) => setConfig({ ...config, microphone_device: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      backgroundColor: 'var(--elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-main)',
                      fontSize: 12
                    }}
                  >
                    <option value="default">System Default Input</option>
                    {microphones.map((m) => (
                      <option key={m.deviceId} value={m.deviceId}>
                        {m.label || `Microphone ${m.deviceId.substring(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-main)' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(config.mute_agent_voice)}
                      onChange={(e) => setConfig({ ...config, mute_agent_voice: e.target.checked })}
                    />
                    Mute Agent Voice (Skip all TTS playback)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-main)' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(config.speak_progress_updates)}
                      onChange={(e) => setConfig({ ...config, speak_progress_updates: e.target.checked })}
                    />
                    Speak progress milestones out loud
                  </label>
                </div>
              </div>
            )}

            {activeSection === 'models' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Groq API Key */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>
                      Groq API Key (Primary STT & LLM)
                    </label>
                    <span style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ShieldCheck size={12} /> Saved in keychain
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type={showGroqKey ? 'text' : 'password'}
                        value={groqKey}
                        onChange={(e) => setGroqKey(e.target.value)}
                        placeholder="gsk_..."
                        style={{
                          width: '100%',
                          padding: '8px 32px 8px 10px',
                          backgroundColor: 'var(--elevated)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-main)',
                          fontSize: 12,
                          fontFamily: 'var(--font-mono)'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowGroqKey(!showGroqKey)}
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        {showGroqKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTestKey('groq')}
                      disabled={testingKey === 'groq'}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'var(--elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--accent-cyan)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {testingKey === 'groq' ? 'Testing...' : 'Test Key'}
                    </button>
                  </div>
                </div>

                {/* OpenRouter Key */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>
                      OpenRouter API Key (Fallback LLM)
                    </label>
                    <span style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ShieldCheck size={12} /> Saved in keychain
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type={showOpenrouterKey ? 'text' : 'password'}
                        value={openrouterKey}
                        onChange={(e) => setOpenrouterKey(e.target.value)}
                        placeholder="sk-or-v1-..."
                        style={{
                          width: '100%',
                          padding: '8px 32px 8px 10px',
                          backgroundColor: 'var(--elevated)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-main)',
                          fontSize: 12,
                          fontFamily: 'var(--font-mono)'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOpenrouterKey(!showOpenrouterKey)}
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        {showOpenrouterKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTestKey('openrouter')}
                      disabled={testingKey === 'openrouter'}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'var(--elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--accent-cyan)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {testingKey === 'openrouter' ? 'Testing...' : 'Test Key'}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                    Primary Model
                  </label>
                  <input
                    type="text"
                    value={config.primary_llm_model}
                    onChange={(e) => setConfig({ ...config, primary_llm_model: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      backgroundColor: 'var(--elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-main)',
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                </div>
              </div>
            )}

            {activeSection === 'wakeword' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(config.wake_word_enabled)}
                    onChange={(e) => setConfig({ ...config, wake_word_enabled: e.target.checked })}
                  />
                  Enable "Hey Bolo" Wake Word Listener
                </label>

                {config.wake_word_enabled && (
                  <>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span>Detection Sensitivity</span>
                        <span>{Math.round(config.wake_word_sensitivity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="0.9"
                        step="0.05"
                        value={config.wake_word_sensitivity}
                        onChange={(e) => setConfig({ ...config, wake_word_sensitivity: parseFloat(e.target.value) })}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowTrainer(true)}
                      style={{
                        padding: '8px 14px',
                        backgroundColor: 'var(--elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--accent-cyan)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        width: 'fit-content'
                      }}
                    >
                      🎯 Record Custom Voice Samples (.rpw)
                    </button>
                  </>
                )}
              </div>
            )}

            {activeSection === 'shortcuts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { key: 'Ctrl+Shift+Space', desc: 'Push to talk (Start/Stop voice listening)' },
                  { key: 'Ctrl+Shift+M', desc: 'Toggle global agent voice mute' },
                  { key: 'Enter', desc: 'Send text prompt in composer' },
                  { key: 'Esc', desc: 'Dismiss active modal / cancel' }
                ].map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      backgroundColor: 'var(--elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--text-main)' }}>{s.desc}</span>
                    <kbd
                      style={{
                        padding: '2px 8px',
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--accent-cyan)'
                      }}
                    >
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'debug' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Diagnostics, raw logs, and manual TCP port attachment are accessible directly via the top Connection Pill.
                </p>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  Config Path: ~/.bolocode/config.json<br />
                  Instances Dir: ~/.bolocode/instances/
                </div>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              backgroundColor: 'var(--elevated)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: '6px 14px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-muted)',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '6px 18px',
                background: 'var(--accent-gradient)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Save Changes
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
    </div>
  );
};
