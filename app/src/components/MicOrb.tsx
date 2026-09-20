import React from 'react';
import { Mic, MicOff, Volume2, AlertCircle, Loader2, Activity } from 'lucide-react';
import { AgentPhase } from '../agent/agentStore';

interface MicOrbProps {
  phase: AgentPhase;
  isMuted?: boolean;
  volumeLevel?: number; // 0 to 100
  onClick?: () => void;
  disabled?: boolean;
  size?: number;
}

export const MicOrb: React.FC<MicOrbProps> = ({
  phase,
  isMuted = false,
  volumeLevel = 0,
  onClick,
  disabled = false,
  size = 64
}) => {
  // Determine effective state
  const isListening = phase === 'listening';
  const isThinking = phase === 'thinking';
  const isActing = phase === 'acting';
  const isSpeaking = phase === 'speaking';
  const isTranscribing = phase === 'transcribing';
  const isError = phase === 'error';

  // Dynamic glow and border styling based on phase
  let bgStyle: string;
  let shadowStyle: string;
  let icon: React.ReactNode;

  if (isMuted) {
    bgStyle = 'linear-gradient(135deg, #374151 0%, #1F2937 100%)';
    shadowStyle = '0 0 0 1px rgba(255, 255, 255, 0.1)';
    icon = <MicOff size={size * 0.42} color="#9CA3AF" />;
  } else if (isListening) {
    bgStyle = 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
    shadowStyle = `0 0 ${16 + volumeLevel * 0.4}px rgba(239, 68, 68, ${0.4 + volumeLevel * 0.006})`;
    icon = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: size * 0.4 }}>
        {[0.4, 0.8, 1, 0.7, 0.3].map((factor, i) => {
          const barHeight = Math.max(4, Math.min(size * 0.38, (volumeLevel * 0.35 + 8) * factor));
          return (
            <div
              key={i}
              style={{
                width: 3,
                height: barHeight,
                backgroundColor: '#FFFFFF',
                borderRadius: 2,
                transition: 'height 0.06s ease'
              }}
            />
          );
        })}
      </div>
    );
  } else if (isSpeaking) {
    bgStyle = 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)';
    shadowStyle = '0 0 24px rgba(139, 92, 246, 0.6)';
    icon = <Volume2 size={size * 0.42} color="#FFFFFF" className="animate-pulse" />;
  } else if (isThinking || isTranscribing) {
    bgStyle = 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)';
    shadowStyle = '0 0 22px rgba(6, 182, 212, 0.5)';
    icon = <Loader2 size={size * 0.42} color="#FFFFFF" style={{ animation: 'spin 1.2s linear infinite' }} />;
  } else if (isActing) {
    bgStyle = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
    shadowStyle = '0 0 20px rgba(16, 185, 129, 0.5)';
    icon = <Activity size={size * 0.42} color="#FFFFFF" />;
  } else if (isError) {
    bgStyle = 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)';
    shadowStyle = '0 0 16px rgba(239, 68, 68, 0.4)';
    icon = <AlertCircle size={size * 0.42} color="#FFFFFF" />;
  } else {
    // Idle state: Subtle cyan-to-violet glow
    bgStyle = 'linear-gradient(135deg, #161E31 0%, #111827 100%)';
    shadowStyle = '0 0 20px rgba(34, 211, 238, 0.2), inset 0 0 12px rgba(139, 92, 246, 0.15)';
    icon = <Mic size={size * 0.42} color="var(--accent-cyan)" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={isListening ? 'Stop listening' : 'Start voice input'}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: bgStyle,
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: shadowStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          position: 'relative',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          outline: 'none',
          padding: 0
        }}
      >
        {/* Orbit ring for thinking */}
        {isThinking && (
          <div
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: 'var(--accent-cyan)',
              borderRightColor: 'var(--accent-violet)',
              animation: 'spin 1.4s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite'
            }}
          />
        )}
        {icon}
      </button>

      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          letterSpacing: '0.02em',
          display: 'flex',
          alignItems: 'center',
          gap: 4
        }}
      >
        <kbd
          style={{
            backgroundColor: 'var(--elevated)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '1px 5px',
            fontSize: 10,
            color: 'var(--text-muted)'
          }}
        >
          Ctrl+Shift+Space
        </kbd>
      </span>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
