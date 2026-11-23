import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

interface ToastAction {
  label: string;
  onClick: () => void;
}
interface ToastState {
  id: number;
  msg: string;
  tone: 'info' | 'success' | 'error';
  action?: ToastAction;
}
type ShowToast = (msg: string, opts?: { tone?: ToastState['tone']; action?: ToastAction; ms?: number }) => void;

const ToastCtx = createContext<ShowToast>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const seq = useRef(0);

  const show = useCallback<ShowToast>((msg, opts = {}) => {
    window.clearTimeout(timer.current);
    const id = ++seq.current;
    setToast({ id, msg, tone: opts.tone ?? 'info', action: opts.action });
    timer.current = window.setTimeout(
      () => setToast((t) => (t?.id === id ? null : t)),
      opts.ms ?? (opts.action ? 5000 : 2600),
    );
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className={`toast toast--${toast.tone}`} key={toast.id}>
            {toast.tone !== 'info' && <Icon name={toast.tone === 'success' ? 'check' : 'alert'} size={18} />}
            <span>{toast.msg}</span>
            {toast.action && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  toast.action!.onClick();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
