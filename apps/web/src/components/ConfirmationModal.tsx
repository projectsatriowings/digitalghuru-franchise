import React from 'react';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  let icon = <HelpCircle className="w-6 h-6 text-[#64748B]" />;
  let btnClass = 'bg-[#006FFF] hover:bg-[#0058D4] text-white';

  if (variant === 'danger') {
    icon = <AlertTriangle className="w-6 h-6 text-rose-600" />;
    btnClass = 'bg-rose-600 hover:bg-rose-700 text-white';
  } else if (variant === 'warning') {
    icon = <AlertTriangle className="w-6 h-6 text-amber-600" />;
    btnClass = 'bg-amber-600 hover:bg-amber-700 text-white';
  }

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-md p-6 shadow-2xl text-[#0F172A] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/60 shrink-0">
              {icon}
            </div>
            <h3 className="text-base font-bold text-[#0F172A]">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#475569] leading-relaxed">{message}</p>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2 rounded-xl text-xs font-semibold shadow-md transition disabled:opacity-50 flex items-center gap-2 ${btnClass}`}
          >
            {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
