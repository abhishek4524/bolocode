import React from 'react';
import { User, Bot, Copy, Check, Sparkles } from 'lucide-react';

export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isStreaming?: boolean;
}

interface ConversationViewProps {
  messages: ChatEntry[];
  onSelectPrompt: (prompt: string) => void;
}

const EXAMPLE_PROMPTS = [
  {
    lang: 'Hindi',
    text: 'todo-app me index.html banao simple list ke sath',
    desc: 'Create todo app structure'
  },
  {
    lang: 'English',
    text: 'create an express server template in index.js',
    desc: 'Boilerplate backend setup'
  },
  {
    lang: 'Hinglish',
    text: 'active file me 15th line pe naya button add karo',
    desc: 'Precision line code edit'
  },
  {
    lang: 'English',
    text: 'search for useState across all workspace files',
    desc: 'Full-text codebase search'
  }
];

export const ConversationView: React.FC<ConversationViewProps> = ({ messages, onSelectPrompt }) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (messages.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 'var(--radius-lg)',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            boxShadow: 'var(--shadow-glow)'
          }}
        >
          <Sparkles size={26} color="#FFFFFF" />
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-main)' }}>
          Start coding with your voice
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 440, marginBottom: 28, lineHeight: 1.5 }}>
          Speak naturally in <strong>Hindi</strong>, <strong>English</strong>, or <strong>Hinglish</strong>. BoloCode transforms your voice instructions directly into code actions.
        </p>

        {/* 4 Clickable Example Chips */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 10,
            width: '100%',
            maxWidth: 580
          }}
        >
          {EXAMPLE_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              onClick={() => onSelectPrompt(item.text)}
              style={{
                textAlign: 'left',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                e.currentTarget.style.backgroundColor = 'var(--elevated)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.backgroundColor = 'var(--surface)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {item.lang}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  {item.desc}
                </span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-main)', fontWeight: 500, lineHeight: 1.3 }}>
                "{item.text}"
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18
      }}
    >
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        return (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              animation: 'fadeIn 0.2s ease'
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-md)',
                backgroundColor: isUser ? 'var(--elevated)' : 'rgba(34, 211, 238, 0.12)',
                border: `1px solid ${isUser ? 'var(--border)' : 'rgba(34, 211, 238, 0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {isUser ? <User size={16} color="var(--text-muted)" /> : <Bot size={16} color="var(--accent-cyan)" />}
            </div>

            {/* Bubble */}
            <div
              style={{
                flex: 1,
                backgroundColor: isUser ? 'var(--surface)' : 'var(--elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 16px',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: isUser ? 'var(--text-muted)' : 'var(--accent-cyan)' }}>
                  {isUser ? 'You' : 'BoloCode'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    {msg.timestamp}
                  </span>
                  <button
                    onClick={() => handleCopy(msg.id, msg.text)}
                    title="Copy message"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 3
                    }}
                  >
                    {copiedId === msg.id ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-main)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {msg.text}
                {msg.isStreaming && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 14,
                      backgroundColor: 'var(--accent-cyan)',
                      marginLeft: 4,
                      verticalAlign: 'middle',
                      animation: 'blink 1s step-start infinite'
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
