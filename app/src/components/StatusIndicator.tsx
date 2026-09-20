import React from 'react';

interface StatusIndicatorProps {
  extensionConnected: boolean;
  onRefresh: () => void;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ extensionConnected, onRefresh }) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 20px',
      backgroundColor: '#1e293b',
      borderRadius: '8px',
      marginBottom: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: extensionConnected ? '#22c55e' : '#ef4444',
          boxShadow: extensionConnected ? '0 0 8px #22c55e' : '0 0 8px #ef4444'
        }} />
        <span style={{ fontSize: '14px', fontWeight: 500, color: '#e2e8f0' }}>
          {extensionConnected ? 'VS Code Connected (127.0.0.1)' : 'VS Code Disconnected'}
        </span>
      </div>

      <button
        onClick={onRefresh}
        style={{
          padding: '6px 12px',
          backgroundColor: '#334155',
          color: '#f8fafc',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px'
        }}
      >
        Check Connection
      </button>
    </div>
  );
};
