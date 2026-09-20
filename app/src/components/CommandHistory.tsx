import React from 'react';

export interface HistoryItem {
  id: string;
  timestamp: string;
  transcript: string;
  reply: string;
  tools: string[];
}

interface CommandHistoryProps {
  items: HistoryItem[];
}

export const CommandHistory: React.FC<CommandHistoryProps> = ({ items }) => {
  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      backgroundColor: '#0f172a',
      borderRadius: '8px',
      padding: '16px',
      border: '1px solid #334155'
    }}>
      <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '12px' }}>
        Activity Log
      </h3>

      {items.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
          No voice commands executed yet. Hold down Ctrl+Space or click Record to speak.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                backgroundColor: '#1e293b',
                padding: '12px',
                borderRadius: '6px',
                borderLeft: '4px solid #38bdf8'
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                {item.timestamp}
              </div>

              <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 600, marginBottom: '4px' }}>
                🎤 "{item.transcript}"
              </div>

              <div style={{ fontSize: '14px', color: '#38bdf8', marginBottom: '6px' }}>
                🤖 {item.reply}
              </div>

              {item.tools.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {item.tools.map((t, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '11px',
                        backgroundColor: '#334155',
                        color: '#cbd5e1',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontFamily: 'monospace'
                      }}
                    >
                      🛠️ {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
