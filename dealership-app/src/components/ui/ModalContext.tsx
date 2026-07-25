import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

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

const Popup: React.FC<{ modal: ModalState; onClose: (value: boolean) => void }> = ({ modal, onClose }) => {
  const getIcon = () => {
    switch (modal.variant) {
      case 'success': return <CheckCircle2 className="text-success" size={24} />;
      case 'warning': return <AlertTriangle className="text-warning" size={24} />;
      case 'error':
      case 'danger': return <AlertCircle className="text-danger" size={24} />;
      default: return <Info className="text-gold-dark" size={24} />;
    }
  };

  const getAccentColor = () => {
    switch (modal.variant) {
      case 'success': return 'border-t-success';
      case 'warning': return 'border-t-warning';
      case 'error':
      case 'danger': return 'border-t-danger';
      default: return 'border-t-gold';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in shadow-2xl">
      <div className={`bg-white w-full max-w-sm rounded-[24px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden border-t-4 ${getAccentColor()} animate-fade-up`}>
        <div className="p-8">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="p-4 bg-muted rounded-2xl">
              {getIcon()}
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-dark tracking-tight">
                {modal.title}
              </h3>
              <p className="text-sm font-medium text-text-secondary leading-relaxed px-2">
                {modal.message}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-muted/30 flex gap-3 border-t border-border/50">
          {modal.type === 'confirm' && (
            <button
              onClick={() => onClose(false)}
              className="flex-1 px-4 py-3.5 bg-white border border-border text-dark text-sm font-bold rounded-xl hover:bg-muted active:scale-[0.98] transition-all duration-200"
            >
              {modal.cancelLabel || 'Cancel'}
            </button>
          )}
          <button
            onClick={() => onClose(true)}
            className={`flex-1 px-4 py-3.5 text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-all duration-200 shadow-lg ${
              modal.variant === 'danger' || modal.variant === 'error' 
                ? 'bg-danger hover:opacity-90 shadow-danger/20'
                : 'bg-dark hover:bg-black shadow-dark/20'
            }`}
          >
            {modal.confirmLabel || (modal.type === 'confirm' ? 'Confirm' : 'Got it')}
          </button>
        </div>
      </div>
    </div>
  );
};
