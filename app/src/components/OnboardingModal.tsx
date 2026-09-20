import React, { useState } from 'react';
import { tauriApi, AppConfig } from '../services/tauriApi';
import logoSymbol from '../assets/logo-symbol.png';

interface OnboardingModalProps {
  config: AppConfig;
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ config, onComplete }) => {
  const [groqKey, setGroqKey] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      if (groqKey.trim()) {
        await tauriApi.saveApiKey('groq', groqKey.trim());
      }
      if (openRouterKey.trim()) {
        await tauriApi.saveApiKey('openrouter', openRouterKey.trim());
      }
      await tauriApi.saveAppSettings({
        ...config,
        onboarding_done: true,
      });
      onComplete();
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '520px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        color: '#f8fafc',
        textAlign: 'center'
      }}>
        <img
          src={logoSymbol}
          alt="BoloCode Logo"
          style={{ width: '80px', height: '80px', margin: '0 auto 16px auto', display: 'block', borderRadius: '12px' }}
        />
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0', color: '#f8fafc' }}>
          Welcome to BoloCode
        </h2>
        <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 24px 0', lineHeight: 1.5 }}>
          Your hands-free, voice-first coding assistant for Visual Studio Code in Hindi, English, and Hinglish.
        </p>

        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Groq API Key (Required for High-Speed Voice & STT)
            </label>
            <input
              type="password"
              placeholder="gsk_..."
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              OpenRouter API Key (Optional Fallback)
            </label>
            <input
              type="password"
              placeholder="sk-or-v1-..."
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px'
              }}
            />
          </div>
        </div>

        <button
          onClick={handleFinish}
          disabled={isSaving}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          {isSaving ? 'Saving Config...' : '🚀 Get Started with BoloCode'}
        </button>
      </div>
    </div>
  );
};
