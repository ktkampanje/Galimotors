import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

const PWAUpdater: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-dark text-white p-4 shadow-2xl border-2 border-gold w-80 animate-in slide-in-from-bottom-5">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <RefreshCw size={16} className="text-gold" />
          Update Available
        </h3>
        <button onClick={() => setNeedRefresh(false)} className="text-gray-400 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>
      <p className="text-xs font-bold text-gray-300 mb-4">
        A new version of GaliMotors is available. Refresh to update to the latest listings and features.
      </p>
      <button 
        onClick={() => updateServiceWorker(true)}
        className="w-full bg-coral hover:bg-opacity-90 text-white py-3 font-semibold text-sm transition-colors rounded-lg mt-2"
      >
        Reload App Now
      </button>
    </div>
  );
};

export default PWAUpdater;
