import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

type ModalType = 'alert' | 'confirm';
type ModalVariant = 'info' | 'success' | 'warning' | 'error' | 'danger';
type ToastVariant = 'info' | 'success' | 'error';

interface ModalOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ModalVariant;
}

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ModalContextType {
  showAlert: (options: ModalOptions) => Promise<void>;
  showConfirm: (options: ModalOptions) => Promise<boolean>;
  /** Transient, non-blocking confirmation (favorites etc.) — auto-dismisses. */
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

interface ModalState extends ModalOptions {
  isOpen: boolean;
  type: ModalType;
  resolve: (value: any) => void;
}

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modal, setModal] = useState<ModalState | null>(null);

  const showAlert = useCallback((options: ModalOptions) => {
    return new Promise<void>((resolve) => {
      setModal({
        ...options,
        isOpen: true,
        type: 'alert',
        resolve,
        variant: options.variant || 'info',
      });
    });
  }, []);

  const showConfirm = useCallback((options: ModalOptions) => {
    return new Promise<boolean>((resolve) => {
      setModal({
        ...options,
        isOpen: true,
        type: 'confirm',
        resolve,
        variant: options.variant || 'warning',
      });
    });
  }, []);

  const handleClose = (value: boolean) => {
    if (modal) {
      modal.resolve(value);
      setModal(null);
    }
  };

  // Toasts. FavoriteButton has called showToast since favorites shipped, but
  // the context never provided it — every tap threw instead of confirming.
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(list => [...list, { id, message, variant }]);
    setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), 2600);
  }, []);

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm, showToast }}>
      {children}
      {modal && <Popup modal={modal} onClose={handleClose} />}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[110] flex flex-col items-center gap-2 px-4 pointer-events-none">
          {toasts.map(t => (
            <div
              key={t.id}
              className="flex items-center gap-2.5 bg-dark text-white text-[13px] font-semibold px-4 py-3 shadow-2xl animate-fade-up max-w-[92vw]"
            >
              {t.variant === 'success' && <CheckCircle2 size={16} className="text-gold shrink-0" />}
              {t.variant === 'error' && <AlertCircle size={16} className="text-danger shrink-0" />}
              {t.variant === 'info' && <Info size={16} className="text-gold shrink-0" />}
              <span className="leading-snug">{t.message}</span>
            </div>
          ))}
        </div>
      )}
    </ModalContext.Provider>
  );
};

/**
 * Dialog in the site's own grammar: the accent bar + bold title every
 * section header uses, left-aligned text, right-aligned natural-width
 * buttons, sharp corners. The old centered icon-in-a-circle with heavy
 * rounding read as an unstyled template default.
 */
const Popup: React.FC<{ modal: ModalState; onClose: (value: boolean) => void }> = ({ modal, onClose }) => {
  const destructive = modal.variant === 'danger' || modal.variant === 'error';
  const accent =
    destructive ? 'bg-danger'
    : modal.variant === 'success' ? 'bg-success'
    : modal.variant === 'warning' ? 'bg-warning'
    : 'bg-gold';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-dark/50 backdrop-blur-sm animate-fade-in"
      onClick={() => onClose(modal.type === 'alert')}
    >
      <div
        className="bg-white w-full max-w-md shadow-2xl border border-border animate-fade-up"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className={`w-1 h-5 shrink-0 ${accent}`} aria-hidden="true" />
            <h3 className="text-[16px] font-bold text-dark tracking-tight">{modal.title}</h3>
          </div>
          <p className="text-[13.5px] text-text-secondary leading-relaxed pl-[14px]">
            {modal.message}
          </p>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2.5">
          {modal.type === 'confirm' && (
            <button
              onClick={() => onClose(false)}
              className="px-5 py-2.5 bg-white border border-border text-dark text-[13px] font-semibold hover:border-dark transition-colors"
            >
              {modal.cancelLabel || 'Cancel'}
            </button>
          )}
          <button
            onClick={() => onClose(true)}
            autoFocus
            className={`px-5 py-2.5 text-white text-[13px] font-semibold transition-colors ${
              destructive ? 'bg-danger hover:opacity-90' : 'bg-coral hover:bg-coral-dark'
            }`}
          >
            {modal.confirmLabel || (modal.type === 'confirm' ? 'Confirm' : 'OK')}
          </button>
        </div>
      </div>
    </div>
  );
};
