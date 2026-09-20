import React, { useEffect, useState } from 'react';
import { AgentRunState } from '../agent/agentStore';

interface AgentTimelineProps {
  state: AgentRunState;
  onCancel: () => void;
}

export const AgentTimeline: React.FC<AgentTimelineProps> = ({ state, onCancel }) => {
  const { phase, intentText, planSteps, toolItems, summary, cancelledWork, runStartedAt } = state;

  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [currentStepElapsedSec, setCurrentStepElapsedSec] = useState<number>(0);

  const isRunning = phase !== 'idle' && phase !== 'error';

  // Overall run elapsed timer
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

  // Step elapsed timer — resets whenever the running tool changes or phase changes
  const activeTool = toolItems.find(t => t.status === 'running');
  const activeStepStart = activeTool ? activeTool.startedAt : runStartedAt;

  useEffect(() => {
    if (!isRunning || !activeStepStart) {
      setCurrentStepElapsedSec(0);
      return;
    }

    const timer = setInterval(() => {
      setCurrentStepElapsedSec(Math.max(0, Math.floor((Date.now() - activeStepStart) / 1000)));
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, activeStepStart]);

  if (phase === 'idle' && toolItems.length === 0 && !summary && cancelledWork.length === 0) {
    return null;
  }

  const phaseColors: Record<string, { bg: string; text: string; border: string }> = {
    thinking: { bg: '#1e1b4b', text: '#a5b4fc', border: '#6366f1' },
    acting: { bg: '#064e3b', text: '#6ee7b7', border: '#10b981' },
    speaking: { bg: '#4a044e', text: '#f0abfc', border: '#d946ef' },
    listening: { bg: '#78350f', text: '#fde68a', border: '#f59e0b' },
    transcribing: { bg: '#312e81', text: '#c7d2fe', border: '#818cf8' },
    error: { bg: '#7f1d1d', text: '#fca5a5', border: '#ef4444' },
    idle: { bg: '#1e293b', text: '#94a3b8', border: '#475569' }
  };

  const currentTheme = phaseColors[phase] || phaseColors.idle;

  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '8px',
      padding: '14px',
      border: '1px solid #334155',
      marginBottom: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      {/* Top Header: Phase Badge + Elapsed Timer + Cancel Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            backgroundColor: currentTheme.bg,
            color: currentTheme.text,
            border: `1px solid ${currentTheme.border}`,
            padding: '3px 8px',
            borderRadius: '12px',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {isRunning && (
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: currentTheme.text,
                display: 'inline-block'
              }} />
            )}
            {phase}
          </span>

          {isRunning && (
            <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>
              ⏱ {elapsedSec}s
            </span>
          )}

          {/* "Not Stuck" 5-second indicator */}
          {isRunning && currentStepElapsedSec >= 5 && (
            <span style={{
              fontSize: '11px',
              color: '#fbbf24',
              backgroundColor: '#451a03',
              border: '1px solid #b45309',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 500
            }}>
              ⏳ Still working... {activeTool ? `(${activeTool.label})` : ''}
            </span>
          )}
        </div>

        {isRunning && (
          <button
            onClick={onCancel}
            style={{
              padding: '4px 10px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ⏹ Stop / Cancel
          </button>
        )}
      </div>

      {/* LLM Intent Sentence (shown in UI, not spoken) */}
      {intentText && (
        <div style={{
          fontSize: '12px',
          color: '#cbd5e1',
          fontStyle: 'italic',
          backgroundColor: '#0f172a',
          padding: '6px 10px',
          borderRadius: '4px',
          borderLeft: '3px solid #38bdf8'
        }}>
          💬 {intentText}
        </div>
      )}

      {/* Plan Checklist (from update_plan) */}
      {planSteps.length > 0 && (
        <div style={{
          backgroundColor: '#0f172a',
          borderRadius: '6px',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Plan
          </div>
          {planSteps.map((step, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span>
                {step.status === 'done' ? '✅' : step.status === 'active' ? '🔄' : step.status === 'failed' ? '❌' : '⬜'}
              </span>
              <span style={{
                color: step.status === 'done' ? '#94a3b8' : step.status === 'active' ? '#38bdf8' : '#f8fafc',
                textDecoration: step.status === 'done' ? 'line-through' : 'none',
                fontWeight: step.status === 'active' ? 600 : 400
              }}>
                {step.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Live Tool Call Timeline */}
      {toolItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {toolItems.map(item => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                backgroundColor: '#0f172a',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>
                  {item.status === 'running' && '⏳'}
                  {item.status === 'ok' && '✅'}
                  {item.status === 'error' && '❌'}
                  {item.status === 'needs_confirmation' && '⚠️'}
                </span>
                <span style={{ color: '#f8fafc', fontWeight: 500 }}>
                  {item.label}
                </span>
              </div>

              {item.durationMs != null && (
                <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                  {item.durationMs}ms
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Run Summary / Cancellation Result */}
      {summary && (
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#34d399',
          backgroundColor: '#064e3b',
          border: '1px solid #059669',
          padding: '6px 10px',
          borderRadius: '4px'
        }}>
          ✨ {summary}
        </div>
      )}

      {cancelledWork.length > 0 && (
        <div style={{
          fontSize: '12px',
          color: '#f87171',
          backgroundColor: '#450a0a',
          border: '1px solid #991b1b',
          padding: '6px 10px',
          borderRadius: '4px'
        }}>
          🛑 Run stopped. Completed work retained:
          <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px' }}>
            {cancelledWork.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
