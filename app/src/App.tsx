import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { ConversationView, ChatEntry } from './components/ConversationView';
import { ActivityPanel } from './components/ActivityPanel';
import { Composer } from './components/Composer';
import { SettingsModal } from './components/SettingsModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { ConnectionDebugPanel } from './components/ConnectionDebugPanel';
import { OnboardingModal } from './components/OnboardingModal';
import { UiGallery } from './components/UiGallery';
import { ToastProvider, useToast } from './components/Toast';

import {
  tauriApi,
  VSCodeInstance,
  ConnectionStatus,
  LlmChatResult,
  CallToolResult,
  AppConfig
} from './services/tauriApi';
import { AGENT_TOOLS_SCHEMA } from './agent/agentLoop';
import { globalBus, agentRunReducer, INITIAL_RUN_STATE, AgentRunState } from './agent/agentStore';
import { runAgentLoopEngine } from './agent/runLoop';
import { useVoiceRecorder } from './hooks/useVoiceRecorder';
import { useWakeWordListener } from './hooks/useWakeWordListener';
import { speakReply, stopSpeaking, classifyVoiceConfirmation } from './utils/ttsPlayer';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface TraceLogItem {
  id: string;
  timestamp: string;
  type: 'user' | 'assistant' | 'tool' | 'system' | 'confirmation' | 'stt' | 'tts' | 'wakeword';
  title: string;
  provider?: string;
  details: any;
  success?: boolean;
}

const AppContent: React.FC = () => {
  const { showToast } = useToast();

  // Route: /ui-gallery support (hash or state)
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    return window.location.pathname === '/ui-gallery' || window.location.hash === '#/ui-gallery'
      ? '/ui-gallery'
      : '/';
  });

  // VS Code Connection State
  const [instances, setInstances] = useState<VSCodeInstance[]>([]);
  const [selectedPid, setSelectedPid] = useState<number | undefined>(undefined);
  const [connectedWorkspace, setConnectedWorkspace] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(false);
  const [manualConnection, setManualConnection] = useState<{ port: number; token: string } | null>(null);

  // App UI & Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Responsive Drawer State (for width < 1100px)
  const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(true);

  // Conversation memory & chat messages
  const conversationMemoryRef = useRef<ChatMessage[]>([]);
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);

  // Confirmation state
  const [confirmationReason, setConfirmationReason] = useState<string | null>(null);
  const [pendingConfirmationState, setPendingConfirmationState] = useState<{
    toolCall: { id: string; name: string; arguments: any };
    messagesState: ChatMessage[];
    stepCount: number;
    provider: string;
  } | null>(null);

  // Agent Run Lifecycle State
  const [runState, setRunState] = useState<AgentRunState>(INITIAL_RUN_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Resize listener
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Subscribe to agent event bus
  useEffect(() => {
    return globalBus.subscribe((evt) => {
      setRunState((prev) => agentRunReducer(prev, evt));

      // Append / stream assistant response directly to chat
      if (evt.type === 'run_started') {
        const userEntry: ChatEntry = {
          id: `msg_u_${Date.now()}`,
          role: 'user',
          text: evt.userText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatEntries((prev) => [...prev, userEntry]);
      } else if (evt.type === 'llm_partial') {
        setChatEntries((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last.isStreaming) {
            return [
              ...prev.slice(0, -1),
              { ...last, text: evt.text }
            ];
          } else {
            return [
              ...prev,
              {
                id: `msg_a_${Date.now()}`,
                role: 'assistant',
                text: evt.text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isStreaming: true
              }
            ];
          }
        });
      } else if (evt.type === 'run_finished') {
        // Mark streaming as finalized
        setChatEntries((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last.isStreaming) {
            return [...prev.slice(0, -1), { ...last, isStreaming: false }];
          }
          return prev;
        });
      }
    });
  }, []);

  // Global hotkey Ctrl+Shift+M for Mute Voice
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        handleToggleMute();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appConfig?.mute_agent_voice]);

  // Refresh active instances & app config
  const refreshContext = useCallback(async () => {
    try {
      const [status, cfg] = await Promise.all([
        tauriApi.checkConnectionStatus(),
        tauriApi.getAppSettings()
      ]);

      setConnectionStatus(status);
      setInstances(status.active_instances);
      setAppConfig(cfg);
      if (!cfg.onboarding_done) setShowOnboarding(true);

      if (status.is_connected || manualConnection) {
        const activeInst = selectedPid
          ? status.active_instances.find((i) => i.pid === selectedPid) || status.selected_instance || status.active_instances[0]
          : status.selected_instance || status.active_instances[0];

        if (!selectedPid && activeInst) setSelectedPid(activeInst.pid);
        setConnectedWorkspace(
          manualConnection
            ? `Manual (Port: ${manualConnection.port})`
            : activeInst?.workspace || 'Workspace Root'
        );
      } else {
        setConnectedWorkspace(null);
      }

      if (status.is_connected || manualConnection) {
        const afRes = await tauriApi.callTool(
          'get_active_file',
          {},
          false,
          selectedPid,
          manualConnection?.port,
          manualConnection?.token
        );
        if (afRes.success && afRes.data && afRes.data.active) {
          setActiveFileName(afRes.data.path);
        }
      }
    } catch (err) {
      console.error('Failed to refresh context:', err);
    }
  }, [selectedPid, manualConnection]);

  useEffect(() => {
    refreshContext();
    const pollMs = connectedWorkspace ? 4000 : 2000;
    const interval = setInterval(refreshContext, pollMs);
    return () => clearInterval(interval);
  }, [refreshContext, connectedWorkspace]);

  // Mute & Pause Listening Toggles
  const handleToggleMute = async () => {
    try {
      const newMuted = await tauriApi.toggleMute();
      setAppConfig((prev) => (prev ? { ...prev, mute_agent_voice: newMuted } : prev));
      if (newMuted) {
        handleStopSpeaking();
        showToast({ type: 'info', title: 'Agent voice muted', message: 'Audio synthesis skipped.' });
      } else {
        showToast({ type: 'info', title: 'Agent voice unmuted', message: 'Neural voice playback active.' });
      }
    } catch (e) {
      console.warn('Failed to toggle mute:', e);
    }
  };

  const handleTogglePauseListening = async () => {
    try {
      const newPaused = await tauriApi.togglePauseListening();
      setAppConfig((prev) => (prev ? { ...prev, pause_listening: newPaused } : prev));
      if (newPaused) {
        showToast({ type: 'warning', title: 'Wake word paused', message: 'Use push-to-talk to trigger commands.' });
      } else {
        showToast({ type: 'success', title: 'Wake word active', message: 'Say "Hey Bolo" anytime.' });
      }
    } catch (e) {
      console.warn('Failed to toggle pause listening:', e);
    }
  };

  const handleSpeakText = async (text: string) => {
    if (appConfig?.mute_agent_voice) return;
    setIsSpeaking(true);
    try {
      await speakReply(text, appConfig?.tts_voice, { muted: appConfig?.mute_agent_voice });
    } catch (e) {
      console.warn('TTS playback error:', e);
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleStopSpeaking = () => {
    stopSpeaking();
    setIsSpeaking(false);
  };

  const handleCancelRun = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    showToast({ type: 'warning', title: 'Execution stopped by user' });
  };

  // Main Agent Execution Flow
  const runAgentLoop = async (userText: string) => {
    handleStopSpeaking();
    setIsProcessing(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    try {
      const result = await runAgentLoopEngine({
        userText,
        bus: globalBus,
        abortSignal: abortCtrl.signal,
        conversationMemory: conversationMemoryRef.current,
        connectedWorkspace: connectedWorkspace || undefined,
        activeFileName: activeFileName || undefined,
        selectedPid,
        speakProgressUpdates: Boolean(appConfig?.speak_progress_updates),
        onSpeakProgress: (msg) => {
          if (!appConfig?.mute_agent_voice) {
            handleSpeakText(msg);
          }
        },
        onNeedsConfirmation: (info) => {
          setConfirmationReason(info.reason);
          setPendingConfirmationState({
            toolCall: info.toolCall,
            messagesState: info.messagesState,
            stepCount: info.stepCount,
            provider: info.provider
          });
          setIsProcessing(false);
          const promptText = `⚠️ Confirmation Required: ${info.reason}. Kya aap aage badhna chahte hain?`;
          handleSpeakText(promptText);
        }
      });

      if (result.status === 'completed' && result.finalReply) {
        setIsProcessing(false);
        // Ensure final reply is recorded in chat
        setChatEntries((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, text: result.finalReply!, isStreaming: false }];
          } else {
            return [
              ...prev,
              {
                id: `msg_a_${Date.now()}`,
                role: 'assistant',
                text: result.finalReply!,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isStreaming: false
              }
            ];
          }
        });
        handleSpeakText(result.finalReply);
      } else if (result.status === 'cancelled') {
        setIsProcessing(false);
        showToast({
          type: 'info',
          title: 'Run cancelled',
          message: `${result.createdFiles?.length || 0} file(s) created were preserved.`
        });
      } else if (result.status === 'error') {
        setIsProcessing(false);
        showToast({
          type: 'error',
          title: 'Agent execution failed',
          message: 'An error occurred while executing the instruction.',
          details: result.error
        });
      }
    } catch (err: any) {
      setIsProcessing(false);
      showToast({
        type: 'error',
        title: 'Unexpected error',
        details: err?.message || String(err)
      });
    } finally {
      abortControllerRef.current = null;
    }
  };

  // Voice recording & STT
  const handleAudioRecorded = async (base64Audio: string) => {
    handleStopSpeaking();
    setIsProcessing(true);

    try {
      const transcript = await tauriApi.sttTranscribe(base64Audio);
      if (!transcript || transcript.trim() === '') {
        showToast({ type: 'warning', title: 'Silent or unclear audio', message: 'Could not detect speech. Please try speaking again.' });
        setIsProcessing(false);
        return;
      }

      if (pendingConfirmationState) {
        const vote = classifyVoiceConfirmation(transcript);
        if (vote === 'yes') {
          await handleConfirmAction();
          return;
        } else if (vote === 'no') {
          handleCancelAction();
          return;
        }
      }

      await runAgentLoop(transcript);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Speech-to-Text error', details: err?.message || String(err) });
      setIsProcessing(false);
    }
  };

  const handleVoiceError = (errMessage: string) => {
    showToast({ type: 'error', title: 'Microphone error', details: errMessage });
  };

  const { isRecording, volumeLevel, toggleRecording } = useVoiceRecorder({
    onAudioRecorded: handleAudioRecorded,
    onError: handleVoiceError,
    deviceDeviceId: appConfig?.microphone_device
  });

  // Background Wake Word Hook
  useWakeWordListener({
    enabled: Boolean(appConfig?.wake_word_enabled && !appConfig?.pause_listening),
    sensitivity: appConfig?.wake_word_sensitivity || 0.50,
    isSTTRecording: isRecording,
    isTTSSpeaking: isSpeaking,
    onWakeWordDetected: () => {
      showToast({ type: 'info', title: 'Wake word detected', message: 'Listening for instruction...' });
      handleStopSpeaking();
      toggleRecording();
    },
    onError: (errStr) => {
      console.warn('Wake Word Warning:', errStr);
    }
  });

  // Dangerous Confirmation Actions
  const handleConfirmAction = async () => {
    if (!pendingConfirmationState) return;
    const { toolCall, messagesState } = pendingConfirmationState;
    setConfirmationReason(null);
    setPendingConfirmationState(null);
    setIsProcessing(true);

    try {
      const toolRes: CallToolResult = await tauriApi.callTool(
        toolCall.name,
        toolCall.arguments,
        true,
        selectedPid
      );

      const toolContent = toolRes.success
        ? JSON.stringify(toolRes.data)
        : JSON.stringify({ error: toolRes.error });

      const updatedMessages = [
        ...messagesState,
        {
          role: 'tool' as const,
          tool_call_id: toolCall.id,
          content: toolContent
        }
      ];

      const finalLlmRes: LlmChatResult = await tauriApi.llmChat(updatedMessages, AGENT_TOOLS_SCHEMA);
      const finalReply = finalLlmRes.content || 'Kaam ho gaya hai.';

      setChatEntries((prev) => [
        ...prev,
        {
          id: `msg_a_${Date.now()}`,
          role: 'assistant',
          text: finalReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isStreaming: false
        }
      ]);

      conversationMemoryRef.current.push({ role: 'assistant', content: finalReply });
      handleSpeakText(finalReply);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Failed to execute confirmed action', details: err?.message || String(err) });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelAction = () => {
    if (!pendingConfirmationState) return;
    const { toolCall, messagesState } = pendingConfirmationState;
    setConfirmationReason(null);
    setPendingConfirmationState(null);

    const updatedMessages = [
      ...messagesState,
      {
        role: 'tool' as const,
        tool_call_id: toolCall.id,
        content: JSON.stringify({ error: 'User rejected dangerous operation confirmation.' })
      }
    ];

    conversationMemoryRef.current = updatedMessages.filter((m) => m.role !== 'system');
    showToast({ type: 'info', title: 'Operation aborted by user' });
  };

  // If user navigated to UI Gallery route
  if (currentRoute === '/ui-gallery') {
    return <UiGallery onBackToApp={() => setCurrentRoute('/')} />;
  }

  const isCompactLayout = windowWidth < 1100;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-main)',
        overflow: 'hidden'
      }}
    >
      {/* 1. Top Professional Header */}
      <Header
        connectionStatus={connectionStatus}
        connectedWorkspace={connectedWorkspace}
        instances={instances}
        selectedPid={selectedPid}
        activeFileName={activeFileName}
        onSelectInstance={(pid) => setSelectedPid(pid)}
        isMuted={Boolean(appConfig?.mute_agent_voice)}
        isPauseListening={Boolean(appConfig?.pause_listening)}
        onToggleMute={handleToggleMute}
        onTogglePauseListening={handleTogglePauseListening}
        onOpenSettings={() => setShowSettings(true)}
        onOpenDebug={() => setShowDebugPanel(true)}
        onReconnect={refreshContext}
        onOpenGallery={() => setCurrentRoute('/ui-gallery')}
      />

      {/* 2. Main Two-Column Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: isCompactLayout ? 'column' : 'row',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Left Column: Conversation View */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0
          }}
        >
          <ConversationView
            messages={chatEntries}
            onSelectPrompt={(text) => runAgentLoop(text)}
          />

          {/* Composer at Bottom */}
          <Composer
            phase={runState.phase}
            isMuted={Boolean(appConfig?.mute_agent_voice)}
            volumeLevel={volumeLevel}
            isProcessing={isProcessing}
            onSendText={(text) => runAgentLoop(text)}
            onToggleMic={toggleRecording}
          />
        </div>

        {/* Right Column / Bottom Drawer: Live Activity Panel */}
        {isCompactLayout && (
          <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border)', backgroundColor: 'var(--elevated)', textAlign: 'center' }}>
            <button
              onClick={() => setDrawerOpen(!drawerOpen)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-cyan)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {drawerOpen ? '▼ Hide Activity Panel' : '▲ Show Activity Panel'}
            </button>
          </div>
        )}
        {(!isCompactLayout || drawerOpen) && (
          <div
            style={{
              width: isCompactLayout ? '100%' : 340,
              height: isCompactLayout ? '240px' : '100%',
              flexShrink: 0,
              borderTop: isCompactLayout ? '1px solid var(--border)' : 'none',
              boxShadow: isCompactLayout ? 'var(--shadow-lg)' : 'none'
            }}
          >
            <ActivityPanel
              state={runState}
              onCancel={handleCancelRun}
            />
          </div>
        )}
      </div>

      {/* Modals & Dialogs */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {showDebugPanel && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
        >
          <div style={{ maxWidth: 740, width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
            <ConnectionDebugPanel
              status={connectionStatus}
              onRefresh={refreshContext}
              onManualConnectSuccess={(port, token) => {
                setManualConnection({ port, token });
                setShowDebugPanel(false);
              }}
            />
            <div style={{ textAlign: 'right', marginTop: 10 }}>
              <button
                onClick={() => setShowDebugPanel(false)}
                style={{
                  padding: '6px 16px',
                  backgroundColor: 'var(--elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600
                }}
              >
                Close Diagnostics
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmationReason && (
        <ConfirmationModal
          reason={confirmationReason}
          spokenPrompt="Kya aap sach me yeh operation execute karna chahte hain?"
          onConfirm={handleConfirmAction}
          onCancel={handleCancelAction}
        />
      )}

      {showOnboarding && appConfig && (
        <OnboardingModal
          config={appConfig}
          onComplete={() => {
            setShowOnboarding(false);
            refreshContext();
          }}
        />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;
