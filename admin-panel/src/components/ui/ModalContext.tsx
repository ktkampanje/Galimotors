import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

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

/**
 * Dialog in the brand's section-header grammar: accent bar + bold title,
 * left-aligned message, right-aligned natural-width buttons. The previous
 * icon-in-a-box with BLACK-UPPERCASE-TRACKING-WIDEST typography read as a
 * template default, not a professional tool.
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/50 backdrop-blur-sm animate-fade-in"
      onClick={() => onClose(modal.type === 'alert')}
    >
      <div
        className="bg-white w-full max-w-md rounded-lg shadow-2xl border border-border animate-fade-up"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className={`w-1 h-5 shrink-0 rounded-full ${accent}`} aria-hidden="true" />
            <h3 className="text-[15px] font-bold text-text-primary tracking-tight">{modal.title}</h3>
          </div>
          <p className="text-[13px] text-text-secondary leading-relaxed pl-[14px]">
            {modal.message}
          </p>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2.5">
          {modal.type === 'confirm' && (
            <button
              onClick={() => onClose(false)}
              className="px-5 py-2.5 bg-white border border-border text-text-primary text-[13px] font-semibold rounded-lg hover:border-gray-400 transition-colors"
            >
              {modal.cancelLabel || 'Cancel'}
            </button>
          )}
          <button
            onClick={() => onClose(true)}
            autoFocus
            className={`px-5 py-2.5 text-white text-[13px] font-semibold rounded-lg transition-colors ${
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
