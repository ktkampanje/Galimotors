import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

type ModalType = 'alert' | 'confirm';
type ModalVariant = 'info' | 'success' | 'warning' | 'error' | 'danger';

interface ModalOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ModalVariant;
}

interface ModalContextType {
  showAlert: (options: ModalOptions) => Promise<void>;
  showConfirm: (options: ModalOptions) => Promise<boolean>;
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

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {modal && <Popup modal={modal} onClose={handleClose} />}
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
      default: return <Info className="text-coral" size={24} />;
    }
  };

  const getAccentColor = () => {
    switch (modal.variant) {
      case 'success': return 'border-t-success';
      case 'warning': return 'border-t-warning';
      case 'error':
      case 'danger': return 'border-t-danger';
      default: return 'border-t-coral';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
      <div className={`bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border-t-4 ${getAccentColor()} animate-fade-up`}>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-muted rounded-xl">
              {getIcon()}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="text-sm font-black uppercase tracking-widest text-dark mb-1">
                {modal.title}
              </h3>
              <p className="text-xs font-semibold text-text-secondary leading-relaxed">
                {modal.message}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-muted/50 flex gap-3">
          {modal.type === 'confirm' && (
            <button
              onClick={() => onClose(false)}
              className="flex-1 px-4 py-3 bg-white border-2 border-border text-dark text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-white hover:border-dark transition-all duration-200"
            >
              {modal.cancelLabel || 'Cancel'}
            </button>
          )}
          <button
            onClick={() => onClose(true)}
            className={`flex-1 px-4 py-3 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all duration-200 shadow-lg ${
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
