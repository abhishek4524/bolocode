import React, { useState, useEffect } from 'react';
import { tauriApi, ConnectionStatus, VSCodeInstance } from '../services/tauriApi';

interface ConnectionDebugPanelProps {
  status: ConnectionStatus | null;
  onRefresh: () => void;
  onManualConnectSuccess: (port: number, token: string) => void;
}

export const ConnectionDebugPanel: React.FC<ConnectionDebugPanelProps> = ({
  status,
  onRefresh,
  onManualConnectSuccess
}) => {
  const [manualPort, setManualPort] = useState<string>('');
  const [manualToken, setManualToken] = useState<string>('');
  const [isTestingManual, setIsTestingManual] = useState<boolean>(false);
  const [manualMessage, setManualMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState<boolean>(true);

  const fetchLogs = async () => {
    try {
      const l = await tauriApi.getAppLogs(50);
      setLogs(l);
    } catch (e) {
      console.warn('Failed to fetch app logs:', e);
    }
  };

  useEffect(() => {
    fetchLogs();
    if (!autoRefreshLogs) return;
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [autoRefreshLogs]);

  const handleManualConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const portNum = parseInt(manualPort.trim(), 10);
    if (isNaN(portNum) || !manualToken.trim()) {
      setManualMessage({ text: 'Please enter a valid numeric Port and auth Token.', success: false });
      return;
    }

    setIsTestingManual(true);
    setManualMessage(null);
    try {
      const res = await tauriApi.connectManual(portNum, manualToken.trim());
      if (res.success) {
        setManualMessage({ text: `Successfully connected to Port ${portNum}!`, success: true });
        onManualConnectSuccess(portNum, manualToken.trim());
        onRefresh();
      } else {
        setManualMessage({ text: `Connection failed: ${res.error || 'Unknown error'}`, success: false });
      }
    } catch (err: any) {
      setManualMessage({ text: `Connection error: ${err.message || String(err)}`, success: false });
    } finally {
      setIsTestingManual(false);
    }
  };

  return (
    <div style={{
      backgroundColor: '#0f172a',
      borderRadius: '8px',
      padding: '16px',
      border: '1px solid #334155',
      marginBottom: '16px',
      color: '#f8fafc',
      fontSize: '13px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
          🔍 Connection Pipeline Diagnostics & Debug Panel
        </h3>
        <button
          onClick={() => {
            onRefresh();
            fetchLogs();
          }}
          style={{
            padding: '4px 10px',
            backgroundColor: '#0284c7',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600
          }}
        >
          🔄 Refresh Status
        </button>
      </div>

      {/* Stage 1: Scanned Folder Info */}
      <div style={{ marginBottom: '12px', backgroundColor: '#1e293b', padding: '10px', borderRadius: '6px' }}>
        <div style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>
          Stage A: Instance Discovery Directory
        </div>
        <div style={{ fontFamily: 'monospace', color: '#f8fafc', marginTop: '4px' }}>
          {status?.scanned_path || 'Loading...'}
        </div>
      </div>

      {/* Stage 2: Discovered Instances List */}
      <div style={{ marginBottom: '12px', backgroundColor: '#1e293b', padding: '10px', borderRadius: '6px' }}>
        <div style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
          Stage B-D: Discovered & Validated Instances ({status?.active_instances?.length || 0})
        </div>
        {!status?.active_instances || status.active_instances.length === 0 ? (
          <div style={{ color: '#ef4444', fontStyle: 'italic', fontSize: '12px' }}>
            ⚠️ No active, reachable instance .json files found in folder. Make sure VS Code is open with extension active.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {status.active_instances.map((inst: VSCodeInstance) => (
              <div
                key={inst.pid}
                style={{
                  backgroundColor: '#0f172a',
                  padding: '8px',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderLeft: '4px solid #22c55e'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                    Workspace: {inst.workspace || 'Workspace Root'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                    PID: {inst.pid} | Port: {inst.port} | Token: {inst.token ? `${inst.token.slice(0, 4)}...${inst.token.slice(-4)}` : 'None'}
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#22c55e', backgroundColor: '#14532d', padding: '2px 8px', borderRadius: '4px' }}>
                  TCP Reachable
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Connection Fallback UI */}
      <div style={{ marginBottom: '12px', backgroundColor: '#1e293b', padding: '10px', borderRadius: '6px' }}>
        <div style={{ color: '#f59e0b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
          🛠️ Manual Fallback Connection (Bypass File Discovery)
        </div>
        <form onSubmit={handleManualConnect} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="number"
            placeholder="Port (e.g. 65135)"
            value={manualPort}
            onChange={(e) => setManualPort(e.target.value)}
            style={{ width: '130px', padding: '6px 10px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
          />
          <input
            type="text"
            placeholder="32-byte Token from VS Code Info"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            style={{ flex: 1, padding: '6px 10px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
          />
          <button
            type="submit"
            disabled={isTestingManual}
            style={{ padding: '6px 12px', backgroundColor: '#f59e0b', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
          >
            {isTestingManual ? 'Testing...' : 'Test & Connect'}
          </button>
        </form>
        {manualMessage && (
          <div style={{ marginTop: '6px', fontSize: '12px', color: manualMessage.success ? '#22c55e' : '#ef4444' }}>
            {manualMessage.text}
          </div>
        )}
      </div>

      {/* Stage E-G: Log Viewer (~/.bolocode/app.log) */}
      <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>
            Live Log Stream (~/.bolocode/app.log)
          </div>
          <label style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefreshLogs}
              onChange={(e) => setAutoRefreshLogs(e.target.checked)}
            />
            Auto-refresh (2s)
          </label>
        </div>
        <pre style={{
          margin: 0,
          backgroundColor: '#0f172a',
          padding: '8px',
          borderRadius: '4px',
          maxHeight: '140px',
          overflowY: 'auto',
          fontSize: '11px',
          fontFamily: 'monospace',
          color: '#cbd5e1',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        }}>
          {logs.length === 0 ? 'No log entries recorded yet.' : logs.join('\n')}
        </pre>
      </div>
    </div>
  );
};
