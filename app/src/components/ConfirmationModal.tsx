import React from 'react';
import { Check, X, ShieldAlert } from 'lucide-react';

interface ConfirmationModalProps {
  reason: string;
  spokenPrompt?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  reason,
  spokenPrompt = 'Kya aap sach me yeh operation execute karna chahte hain?',
  onConfirm,
  onCancel
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20
      }}
      role="alertdialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
    >
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--danger-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px 28px',
          maxWidth: 480,
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
          animation: 'scaleIn 0.15s ease'
        }}
      >
        {/* Header with warning icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ShieldAlert size={20} color="var(--danger)" />
          </div>

          <div>
            <h2 id="confirm-title" style={{ color: 'var(--danger)', fontSize: 16, fontWeight: 700, margin: 0 }}>
              Dangerous Action Requires Confirmation
            </h2>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              A high-risk or irreversible tool operation was requested.
            </span>
          </div>
        </div>

        {/* Action description & path preview */}
        <div
          id="confirm-desc"
          style={{
            backgroundColor: 'var(--elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            marginBottom: 16
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>
            Operation Detail
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-main)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
            {reason}
          </div>
        </div>

        {/* Spoken prompt hint */}
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            fontStyle: 'italic',
            marginBottom: 24,
            paddingLeft: 4
          }}
        >
          🗣️ Spoken prompt: "{spokenPrompt}"
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              backgroundColor: 'var(--elevated)',
              color: 'var(--text-main)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 13,
              transition: 'all 0.15s ease'
            }}
          >
            <X size={14} />
            <span>Nahi / Cancel</span>
          </button>

          <button
            onClick={onConfirm}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              backgroundColor: 'var(--danger)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
              boxShadow: '0 2px 8px rgba(248, 113, 113, 0.4)',
              transition: 'all 0.15s ease'
            }}
          >
            <Check size={14} />
            <span>Haan / Confirm & Execute</span>
          </button>
        </div>
      </div>
    </div>
  );
};
