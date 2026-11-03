import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastType, ToastMessage } from '@tuition/shared';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 4000) => {
      // Deduplicate recent identical messages
      setToasts((prev) => {
        if (prev.some((t) => t.message === message)) {
          return prev;
        }
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        return [...prev, { id, type, message, duration }];
      });

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.message !== message));
        }, duration);
      }
    },
    []
  );

  const success = useCallback((msg: string, d?: number) => showToast(msg, 'success', d), [showToast]);
  const error = useCallback((msg: string, d?: number) => showToast(msg, 'error', d), [showToast]);
  const warning = useCallback((msg: string, d?: number) => showToast(msg, 'warning', d), [showToast]);
  const info = useCallback((msg: string, d?: number) => showToast(msg, 'info', d), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}

      {/* Global Toast Container - Top Right (Desktop) / Top Center (Mobile) */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-2 sm:px-0">
        {toasts.map((toast) => {
          let bgClass = 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]';
          let icon = <Info className="w-5 h-5 text-[#94A3B8] shrink-0" />;

          if (toast.type === 'success') {
            bgClass = 'bg-emerald-50/95 border-emerald-300 text-emerald-950 shadow-emerald-900/10';
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
          } else if (toast.type === 'error') {
            bgClass = 'bg-rose-50/95 border-rose-300 text-rose-950 shadow-rose-900/10';
            icon = <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />;
          } else if (toast.type === 'warning') {
            bgClass = 'bg-amber-50/95 border-amber-300 text-amber-950 shadow-amber-900/10';
            icon = <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
          } else {
            bgClass = 'bg-[#FFFFFF]/95 border-[#E2E8F0] text-[#006FFF] shadow-[#4E342E]/10';
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-lg backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-3 ${bgClass}`}
            >
              <div className="mt-0.5">{icon}</div>
              <div className="flex-1 text-xs font-medium leading-relaxed">{toast.message}</div>
              <button
                onClick={() => removeToast(toast.id)}
                className="opacity-70 hover:opacity-100 p-0.5 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
