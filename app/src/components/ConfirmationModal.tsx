import React from 'react';

interface ConfirmationModalProps {
  reason: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ reason, onConfirm, onCancel }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1e293b',
        border: '2px solid #ef4444',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '480px',
        width: '90%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span style={{ fontSize: '28px' }}>⚠️</span>
          <h2 style={{ color: '#ef4444', fontSize: '18px', margin: 0 }}>
            Dangerous Action Confirmation
          </h2>
        </div>

        <p style={{ color: '#e2e8f0', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
          {reason}
        </p>

        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '24px' }}>
          Kya aap sach me yeh operation perform karna chahte hain? (Do you really want to proceed?)
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              backgroundColor: '#475569',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Nahi / Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Haan / Confirm & Execute
          </button>
        </div>
      </div>
    </div>
  );
};
