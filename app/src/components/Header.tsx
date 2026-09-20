import React, { useState, useRef, useEffect } from 'react';
import {
  RefreshCw,
  Sparkles,
  Volume2,
  VolumeX,
  Ear,
  EarOff,
  Settings,
  ChevronDown,
  Folder,
  FileCode2,
  Check,
  Layers
} from 'lucide-react';
import logoSymbol from '../assets/logo-symbol.png';
import { ConnectionStatus, VSCodeInstance } from '../services/tauriApi';

interface HeaderProps {
  connectionStatus: ConnectionStatus | null;
  connectedWorkspace: string | null;
  instances: VSCodeInstance[];
  selectedPid: number | undefined;
  activeFileName: string | null;
  onSelectInstance: (pid: number | undefined) => void;
  isMuted: boolean;
  isPauseListening: boolean;
  onToggleMute: () => void;
  onTogglePauseListening: () => void;
  onOpenSettings: () => void;
  onOpenDebug: () => void;
  onReconnect: () => void;
  onOpenGallery?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connectionStatus,
  connectedWorkspace,
  instances,
  selectedPid,
  activeFileName,
  onSelectInstance,
  isMuted,
  isPauseListening,
  onToggleMute,
  onTogglePauseListening,
  onOpenSettings,
  onOpenDebug,
  onReconnect,
  onOpenGallery
}) => {
  const isConnected = Boolean(connectedWorkspace);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to extract clean project/folder name
  const getWorkspaceDisplayName = (ws?: string) => {
    if (!ws) return 'Workspace Root';
    return ws.replace(/\\/g, '/').split('/').filter(Boolean).pop() || ws;
  };

  const activeInstance = selectedPid
    ? instances.find((i) => i.pid === selectedPid)
    : connectionStatus?.selected_instance || instances[0];

  const currentProjectName = activeInstance?.workspace
    ? getWorkspaceDisplayName(activeInstance.workspace)
    : (connectedWorkspace || 'VS Code Disconnected');

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 18px',
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        height: 56,
        flexShrink: 0,
        position: 'relative',
        zIndex: 50
      }}
    >
      {/* Left: Branding + Product Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img
          src={logoSymbol}
          alt="BoloCode Logo"
          style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)' }}
        />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              background: 'var(--accent-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            BoloCode
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Voice Agent
          </span>
        </div>
      </div>

      {/* Center: Prominent Project / VS Code Workspace Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }} ref={dropdownRef}>
        {/* Workspace Dropdown Trigger */}
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          title="Click to view all open VS Code projects & switch active workspace"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '5px 14px',
            backgroundColor: isConnected ? 'var(--elevated)' : 'var(--danger-bg)',
            border: `1px solid ${isConnected ? 'var(--border)' : 'var(--danger-border)'}`,
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-main)',
            transition: 'all 0.15s ease',
            boxShadow: dropdownOpen ? 'var(--shadow-glow)' : 'none'
          }}
        >
          {/* Status Dot */}
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: isConnected ? 'var(--success)' : 'var(--danger)',
              boxShadow: isConnected ? '0 0 8px var(--success)' : '0 0 8px var(--danger)',
              flexShrink: 0
            }}
          />

          {/* Project Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Folder size={14} color={isConnected ? 'var(--accent-cyan)' : 'var(--danger)'} />
            <span style={{ fontWeight: 600, color: 'var(--text-main)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isConnected ? currentProjectName : 'Disconnected'}
            </span>
          </div>

          {/* Count Badge if multiple instances open */}
          {instances.length > 1 && (
            <span
              style={{
                fontSize: 10,
                backgroundColor: 'rgba(34, 211, 238, 0.15)',
                color: 'var(--accent-cyan)',
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 600
              }}
            >
              {instances.length} open
            </span>
          )}

          <ChevronDown
            size={13}
            color="var(--text-muted)"
            style={{
              transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease'
            }}
          />
        </button>

        {/* Active File Chip (if file is currently open in VS Code) */}
        {activeFileName && isConnected && (
          <div
            title={`Active editor file: ${activeFileName}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-full)',
              fontSize: 11,
              color: 'var(--accent-cyan)',
              maxWidth: 160,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            <FileCode2 size={12} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeFileName.split(/[/\\]/).pop()}
            </span>
          </div>
        )}

        {/* Reconnect button if disconnected */}
        {!isConnected && (
          <button
            onClick={onReconnect}
            title="Attempt reconnecting to VS Code"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              backgroundColor: 'var(--elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-main)',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={12} />
            Reconnect
          </button>
        )}

        {/* Workspace Dropdown Menu */}
        {dropdownOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              width: 320,
              backgroundColor: 'var(--elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '8px',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 100,
              animation: 'scaleIn 0.12s ease'
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                letterSpacing: '0.06em',
                padding: '4px 8px 8px 8px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>Open VS Code Projects</span>
              <span style={{ color: 'var(--accent-cyan)' }}>{instances.length} Found</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, maxHeight: 220, overflowY: 'auto' }}>
              {/* Option 1: Auto-detect active window (default) */}
              <button
                onClick={() => {
                  onSelectInstance(undefined);
                  setDropdownOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: !selectedPid ? 'var(--surface)' : 'transparent',
                  border: `1px solid ${!selectedPid ? 'var(--accent-cyan)' : 'transparent'}`,
                  color: 'var(--text-main)',
                  fontSize: 12,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={14} color="var(--accent-cyan)" />
                  <div>
                    <div style={{ fontWeight: 600 }}>Auto-detect Focused Window</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Follows whichever VS Code window you focus</div>
                  </div>
                </div>
                {!selectedPid && <Check size={14} color="var(--accent-cyan)" />}
              </button>

              {/* Individual Instances List */}
              {instances.map((inst) => {
                const isSelected = selectedPid === inst.pid;
                const folderName = getWorkspaceDisplayName(inst.workspace);

                return (
                  <button
                    key={inst.pid}
                    onClick={() => {
                      onSelectInstance(inst.pid);
                      setDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? 'var(--surface)' : 'transparent',
                      border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'transparent'}`,
                      color: 'var(--text-main)',
                      fontSize: 12,
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <Folder size={14} color={isSelected ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {folderName}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          PID: {inst.pid} · Port: {inst.port}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check size={14} color="var(--accent-cyan)" />}
                  </button>
                );
              })}

              {instances.length === 0 && (
                <div style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                  No active VS Code instances detected. Make sure the BoloCode extension is enabled in VS Code.
                </div>
              )}
            </div>

            {/* Bottom link to Connection Diagnostics */}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, textAlign: 'right' }}>
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenDebug();
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-cyan)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 6px'
                }}
              >
                🔍 Open Connection Diagnostics
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Quick Toggles (Mute, Pause Listening, Settings, Gallery) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Mute Voice Toggle */}
        <button
          onClick={onToggleMute}
          title={isMuted ? 'Voice Muted (Ctrl+Shift+M) — Click to Unmute' : 'Voice Active (Ctrl+Shift+M) — Click to Mute'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            backgroundColor: isMuted ? 'var(--danger-bg)' : 'var(--elevated)',
            border: `1px solid ${isMuted ? 'var(--danger-border)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            color: isMuted ? 'var(--danger)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            transition: 'all 0.15s ease'
          }}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          <span>{isMuted ? 'Muted' : 'Voice'}</span>
        </button>

        {/* Pause Listening Toggle */}
        <button
          onClick={onTogglePauseListening}
          title={isPauseListening ? 'Wake Word Paused — Click to Resume' : 'Wake Word Active ("Hey Bolo") — Click to Pause'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            backgroundColor: isPauseListening ? 'var(--warning-bg)' : 'var(--elevated)',
            border: `1px solid ${isPauseListening ? 'var(--warning-border)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            color: isPauseListening ? 'var(--warning)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            transition: 'all 0.15s ease'
          }}
        >
          {isPauseListening ? <EarOff size={14} /> : <Ear size={14} />}
          <span>{isPauseListening ? 'Paused' : 'Wake Word'}</span>
        </button>

        {/* UI Gallery Dev Link */}
        {onOpenGallery && (
          <button
            onClick={onOpenGallery}
            title="Open UI Gallery (Dev Testing)"
            style={{
              padding: '6px 8px',
              backgroundColor: 'var(--elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--accent-cyan)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              fontSize: 12
            }}
          >
            <Sparkles size={14} />
          </button>
        )}

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          title="Open Settings"
          style={{
            padding: '6px 10px',
            backgroundColor: 'var(--elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 500
          }}
        >
          <Settings size={14} />
          <span>Settings</span>
        </button>
      </div>
    </header>
  );
};
