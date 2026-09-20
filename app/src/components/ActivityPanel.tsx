import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Circle, AlertCircle, XCircle, ChevronDown, ChevronUp, Square, Loader2, Sparkles, Activity } from 'lucide-react';
import { AgentRunState } from '../agent/agentStore';

interface ActivityPanelProps {
  state: AgentRunState;
  onCancel: () => void;
}

export const ActivityPanel: React.FC<ActivityPanelProps> = ({ state, onCancel }) => {
  const { phase, intentText, planSteps, toolItems, summary, cancelledWork, runStartedAt } = state;
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isRunning = phase !== 'idle' && phase !== 'error';

  // Live timer ticking every second
  useEffect(() => {
    if (!isRunning || !runStartedAt) {
      setElapsedSec(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - runStartedAt) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning, runStartedAt]);

  // Auto-scroll tool items when new ones arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [toolItems.length]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        overflow: 'hidden'
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--elevated)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={15} color="var(--accent-cyan)" />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            Live Activity
          </span>
          {isRunning && (
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              ⏱ {elapsedSec}s
            </span>
          )}
        </div>

        {isRunning && (
          <button
            onClick={onCancel}
            title="Stop execution and cancel remaining operations"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              backgroundColor: 'var(--danger)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Square size={10} fill="#FFFFFF" />
            Stop
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
      >
        {/* Intent Sentence */}
        {intentText && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-main)',
              fontStyle: 'italic',
              backgroundColor: 'var(--elevated)',
              border: '1px solid var(--border)',
              borderLeft: '3px solid var(--accent-cyan)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              lineHeight: 1.4
            }}
          >
            💬 {intentText}
          </div>
        )}

        {/* Section 1: Plan Checklist */}
        {planSteps.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Execution Plan
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                backgroundColor: 'var(--elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px'
              }}
            >
              {planSteps.map((step, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  {step.status === 'done' && <CheckCircle2 size={14} color="var(--success)" />}
                  {step.status === 'active' && <Loader2 size={14} color="var(--accent-cyan)" style={{ animation: 'spin 1.2s linear infinite' }} />}
                  {step.status === 'pending' && <Circle size={14} color="var(--text-dim)" />}
                  {step.status === 'failed' && <XCircle size={14} color="var(--danger)" />}

                  <span
                    style={{
                      color: step.status === 'done' ? 'var(--text-muted)' : step.status === 'active' ? 'var(--accent-cyan)' : 'var(--text-main)',
                      textDecoration: step.status === 'done' ? 'line-through' : 'none',
                      fontWeight: step.status === 'active' ? 600 : 400
                    }}
                  >
                    {step.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 2: Real Tool Timeline */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Tool Operations ({toolItems.length})
          </div>

          {toolItems.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', padding: '12px 0' }}>
              No operations dispatched yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {toolItems.map((item) => {
                const isExpanded = expandedToolId === item.id;
                return (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: 'var(--elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div
                      onClick={() => setExpandedToolId(isExpanded ? null : item.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        {item.status === 'running' && <Loader2 size={13} color="var(--accent-cyan)" style={{ animation: 'spin 1.2s linear infinite' }} />}
                        {item.status === 'ok' && <CheckCircle2 size={13} color="var(--success)" />}
                        {item.status === 'error' && <XCircle size={13} color="var(--danger)" />}
                        {item.status === 'needs_confirmation' && <AlertCircle size={13} color="var(--warning)" />}

                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.label}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.durationMs != null && (
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            {item.durationMs}ms
                          </span>
                        )}
                        {isExpanded ? <ChevronUp size={12} color="var(--text-muted)" /> : <ChevronDown size={12} color="var(--text-muted)" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div
                        style={{
                          padding: '6px 10px 8px 10px',
                          borderTop: '1px solid var(--border)',
                          backgroundColor: 'rgba(0, 0, 0, 0.25)',
                          fontSize: 11,
                          color: 'var(--text-muted)'
                        }}
                      >
                        <div style={{ marginBottom: 4 }}>
                          <span style={{ color: 'var(--text-dim)' }}>Tool: </span>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{item.name}</span>
                        </div>
                        {item.summary && (
                          <div>
                            <span style={{ color: 'var(--text-dim)' }}>Result: </span>
                            <span>{item.summary}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3: Summary Card / Retained files on Cancel */}
        {summary && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--success-bg)',
              border: '1px solid var(--success-border)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Sparkles size={16} color="var(--success)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>
              {summary}
            </span>
          </div>
        )}

        {cancelledWork.length > 0 && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: 'var(--danger)'
            }}
          >
            <strong>Run cancelled.</strong> Preserved actions:
            <ul style={{ margin: '4px 0 0 0', paddingLeft: 16 }}>
              {cancelledWork.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
