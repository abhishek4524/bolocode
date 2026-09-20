import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X, ChevronDown, ChevronUp } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  details?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newItem: ToastItem = { ...toast, id };
    setToasts((prev) => [newItem, ...prev].slice(0, 5));

    const duration = toast.duration ?? (toast.type === 'error' ? 8000 : 4500);
    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};

const ToastContainer: React.FC<{ toasts: ToastItem[]; onDismiss: (id: string) => void }> = ({
  toasts,
  onDismiss
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 420,
        width: 'calc(100vw - 48px)',
        pointerEvents: 'none'
      }}
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const [showDetails, setShowDetails] = useState(false);

  const getColors = () => {
    switch (toast.type) {
      case 'success':
        return { border: 'var(--success-border)', icon: <CheckCircle2 size={18} color="var(--success)" /> };
      case 'warning':
        return { border: 'var(--warning-border)', icon: <AlertTriangle size={18} color="var(--warning)" /> };
      case 'error':
        return { border: 'var(--danger-border)', icon: <XCircle size={18} color="var(--danger)" /> };
      case 'info':
      default:
        return { border: 'rgba(34, 211, 238, 0.3)', icon: <Info size={18} color="var(--accent-cyan)" /> };
    }
  };

  const { border, icon } = getColors();

  return (
    <div
      style={{
        pointerEvents: 'auto',
        backgroundColor: 'var(--elevated)',
        border: `1px solid ${border}`,
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'all 0.2s ease',
        animation: 'slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      role="status"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon}
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-main)' }}>
            {toast.title}
          </div>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 4
          }}
        >
          <X size={14} />
        </button>
      </div>

      {toast.message && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 28, lineHeight: 1.4 }}>
          {toast.message}
        </div>
      )}

      {toast.details && (
        <div style={{ paddingLeft: 28, marginTop: 4 }}>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-cyan)',
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: 0,
              fontWeight: 500
            }}
          >
            {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showDetails ? 'Hide technical details' : 'View technical details'}
          </button>
          {showDetails && (
            <pre
              style={{
                marginTop: 6,
                padding: '6px 8px',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-muted)',
                maxHeight: 120,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}
            >
              {toast.details}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
