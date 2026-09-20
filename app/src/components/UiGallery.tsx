import React, { useState } from 'react';
import { MicOrb } from '../components/MicOrb';
import { ActivityPanel } from '../components/ActivityPanel';
import { ChatEntry } from '../components/ConversationView';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ConnectionDebugPanel } from '../components/ConnectionDebugPanel';
import { useToast } from '../components/Toast';
import { AgentPhase, AgentRunState } from '../agent/agentStore';

export const BOLOCODE_MOCK = {
  connectionConnected: {
    is_connected: true,
    scanned_path: 'C:\\Users\\user\\.bolocode\\instances',
    active_instances: [
      { pid: 14208, port: 52140, token: 'mock_token_abc', workspace: 'c:\\Users\\user\\Downloads\\BoloCode', is_reachable: true }
    ],
    selected_instance: { pid: 14208, port: 52140, token: 'mock_token_abc', workspace: 'c:\\Users\\user\\Downloads\\BoloCode', is_reachable: true },
    status_message: 'Connected to BoloCode (Port: 52140)',
    log_lines: ['[INFO] Handshake authenticated successfully.']
  },
  connectionDisconnected: {
    is_connected: false,
    scanned_path: 'C:\\Users\\user\\.bolocode\\instances',
    active_instances: [],
    selected_instance: undefined,
    status_message: 'No reachable VS Code instances found on 127.0.0.1',
    log_lines: ['[WARN] TCP connection refused on scanned ports.']
  },
  messages: [
    { id: '1', role: 'user', text: 'todo-app me index.html banao simple list ke sath', timestamp: '3:45:10 PM' },
    { id: '2', role: 'assistant', text: 'Main index.html file create kar raha hoon basic HTML structure ke sath.', timestamp: '3:45:12 PM' },
    { id: '3', role: 'user', text: 'is file me 15th line pe naya button add karo', timestamp: '3:45:30 PM' },
    { id: '4', role: 'assistant', text: 'Index.html ki 15th line me naya button code inject kar diya gaya hai.', timestamp: '3:45:32 PM' }
  ] as ChatEntry[],
  runningState: {
    phase: 'acting' as AgentPhase,
    runId: 'mock_run_1',
    userText: 'create todo app with index.html and style.css',
    intentText: 'Main todo-app folder aur 2 files create kar raha hoon.',
    partialText: null,
    planSteps: [
      { title: 'Create todo-app directory', status: 'done' as const },
      { title: 'Write index.html template', status: 'active' as const },
      { title: 'Write style.css styles', status: 'pending' as const }
    ],
    toolItems: [
      { id: 't1', name: 'create_folder', label: 'Creating folder todo-app', startedAt: Date.now() - 1200, status: 'ok' as const, durationMs: 240, summary: 'Created todo-app' },
      { id: 't2', name: 'create_file', label: 'Writing index.html', startedAt: Date.now() - 400, status: 'running' as const }
    ],
    summary: null,
    cancelledWork: [],
    runStartedAt: Date.now() - 2500
  } as AgentRunState,
  doneState: {
    phase: 'idle' as AgentPhase,
    runId: 'mock_run_2',
    userText: 'completed task',
    intentText: null,
    partialText: null,
    planSteps: [
      { title: 'Create todo-app directory', status: 'done' as const },
      { title: 'Write index.html template', status: 'done' as const },
      { title: 'Write style.css styles', status: 'done' as const }
    ],
    toolItems: [
      { id: 't1', name: 'create_folder', label: 'Creating folder todo-app', startedAt: Date.now() - 3000, status: 'ok' as const, durationMs: 180 },
      { id: 't2', name: 'create_file', label: 'Writing index.html', startedAt: Date.now() - 2800, status: 'ok' as const, durationMs: 320 },
      { id: 't3', name: 'create_file', label: 'Writing style.css', startedAt: Date.now() - 2400, status: 'ok' as const, durationMs: 290 }
    ],
    summary: 'Done: 2 files created, 1 folder, 2.8s',
    cancelledWork: [],
    runStartedAt: Date.now() - 4000
  } as AgentRunState
};

export const UiGallery: React.FC<{ onBackToApp: () => void }> = ({ onBackToApp }) => {
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [activeTab, setActiveTab] = useState<'orbs' | 'states' | 'toasts'>('orbs');

  const orbPhases: AgentPhase[] = [
    'idle',
    'listening',
    'transcribing',
    'thinking',
    'acting',
    'speaking',
    'error'
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-main)',
        overflowY: 'auto'
      }}
    >
      {/* Top Banner */}
      <div
        style={{
          padding: '12px 24px',
          backgroundColor: 'var(--elevated)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🎨 BoloCode /ui-gallery
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Component & State Showcase for UI Testing
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {(['orbs', 'states', 'toasts'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '5px 12px',
                backgroundColor: activeTab === tab ? 'var(--surface)' : 'transparent',
                border: `1px solid ${activeTab === tab ? 'var(--accent-cyan)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                color: activeTab === tab ? 'var(--accent-cyan)' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {tab}
            </button>
          ))}

          <button
            onClick={onBackToApp}
            style={{
              padding: '5px 14px',
              background: 'var(--accent-gradient)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              marginLeft: 12
            }}
          >
            Back to Live App
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {/* Tab 1: Orb States */}
        {activeTab === 'orbs' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text-main)' }}>
              1. Animated Mic Orb States
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 20,
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                padding: '24px 20px'
              }}
            >
              {orbPhases.map((phase) => (
                <div key={phase} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <MicOrb phase={phase} volumeLevel={phase === 'listening' ? 65 : 0} size={56} />
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {phase}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <MicOrb phase="idle" isMuted={true} size={56} />
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  muted
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Activity States & Modals */}
        {activeTab === 'states' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
              2. Activity & Confirmation Components
            </h3>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowModal(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--danger-bg)',
                  border: '1px solid var(--danger-border)',
                  color: 'var(--danger)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600
                }}
              >
                Trigger Confirmation Modal
              </button>
              <button
                onClick={() => setShowDebug(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600
                }}
              >
                Trigger Connection Debug Panel
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, height: 420 }}>
              <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{ padding: '8px 12px', backgroundColor: 'var(--elevated)', fontSize: 12, fontWeight: 600, color: 'var(--accent-cyan)' }}>
                  State: Active Run (Acting + Plan)
                </div>
                <div style={{ height: 'calc(100% - 33px)' }}>
                  <ActivityPanel state={BOLOCODE_MOCK.runningState} onCancel={() => {}} />
                </div>
              </div>

              <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{ padding: '8px 12px', backgroundColor: 'var(--elevated)', fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>
                  State: Completed Run (Summary Card)
                </div>
                <div style={{ height: 'calc(100% - 33px)' }}>
                  <ActivityPanel state={BOLOCODE_MOCK.doneState} onCancel={() => {}} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Toast System */}
        {activeTab === 'toasts' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text-main)' }}>
              3. Toast Notification Types
            </h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => showToast({ type: 'success', title: 'File created successfully', message: 'todo-app/index.html written with 24 lines.' })}
                style={{ padding: '8px 16px', backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
              >
                Success Toast
              </button>
              <button
                onClick={() => showToast({ type: 'warning', title: 'Operation delayed', message: 'Network connection is running slower than usual.' })}
                style={{ padding: '8px 16px', backgroundColor: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
              >
                Warning Toast
              </button>
              <button
                onClick={() => showToast({ type: 'error', title: 'Tool execution error', message: 'File not found in workspace sandboxing boundary.', details: 'OUT_OF_BOUNDS: Path /etc/passwd escapes workspace root c:\\Users\\user\\Downloads\\BoloCode' })}
                style={{ padding: '8px 16px', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
              >
                Error Toast (With Details)
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <ConfirmationModal
          reason="rm -rf /c/Users/user/Downloads/BoloCode/build"
          spokenPrompt="Kya aap sach me build folder delete karna chahte hain?"
          onConfirm={() => {
            setShowModal(false);
            showToast({ type: 'success', title: 'Action confirmed' });
          }}
          onCancel={() => setShowModal(false)}
        />
      )}

      {showDebug && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ maxWidth: 700, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <ConnectionDebugPanel
              status={BOLOCODE_MOCK.connectionConnected}
              onRefresh={() => {}}
              onManualConnectSuccess={() => {}}
            />
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <button onClick={() => setShowDebug(false)} style={{ padding: '6px 14px', backgroundColor: 'var(--elevated)', color: '#fff', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>Close Debug</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
