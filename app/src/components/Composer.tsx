import React, { useState } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { MicOrb } from './MicOrb';
import { AgentPhase } from '../agent/agentStore';

interface ComposerProps {
  phase: AgentPhase;
  isMuted: boolean;
  volumeLevel: number;
  isProcessing: boolean;
  onSendText: (text: string) => void;
  onToggleMic: () => void;
}

export const Composer: React.FC<ComposerProps> = ({
  phase,
  isMuted,
  volumeLevel,
  isProcessing,
  onSendText,
  onToggleMic
}) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isProcessing) return;
    onSendText(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      style={{
        padding: '14px 20px',
        backgroundColor: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        position: 'relative'
      }}
    >
      {/* Central Interactive Mic Orb */}
      <MicOrb
        phase={phase}
        isMuted={isMuted}
        volumeLevel={volumeLevel}
        disabled={isProcessing}
        onClick={onToggleMic}
        size={54}
      />

      {/* Input Composer Field */}
      <form
        onSubmit={handleSubmit}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '6px 8px 6px 14px',
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.15s ease'
        }}
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask BoloCode anything in Hindi, English, or Hinglish..."
          disabled={isProcessing}
          aria-label="Instruction prompt"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-main)',
            fontSize: 13,
            padding: '4px 0'
          }}
        />

        <button
          type="submit"
          disabled={isProcessing || !text.trim()}
          title="Send instruction (Enter)"
          aria-label="Send prompt"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-md)',
            background: text.trim() && !isProcessing ? 'var(--accent-gradient)' : 'transparent',
            border: 'none',
            color: text.trim() && !isProcessing ? '#FFFFFF' : 'var(--text-dim)',
            cursor: text.trim() && !isProcessing ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
            flexShrink: 0
          }}
        >
          <CornerDownLeft size={14} />
        </button>
      </form>
    </div>
  );
};
