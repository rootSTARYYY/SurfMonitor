import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { ToastItem } from '@/types';

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const TONE_MAP: Record<
  ToastItem['tone'],
  { icon: React.ComponentType<{ className?: string }>; border: string; iconColor: string }
> = {
  success: {
    icon: CheckCircle2,
    border: 'border-emerald-500/30',
    iconColor: 'text-emerald-400',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-500/30',
    iconColor: 'text-amber-400',
  },
  error: {
    icon: XCircle,
    border: 'border-rose-500/30',
    iconColor: 'text-rose-400',
  },
  info: {
    icon: Info,
    border: 'border-white/[0.12]',
    iconColor: 'text-zinc-300',
  },
};

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const cfg = TONE_MAP[toast.tone];
        const Icon = cfg.icon;
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-2.5 rounded border bg-[#111216] p-3 shadow-2xl ${cfg.border}`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.iconColor}`} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-zinc-100">
                {toast.title}
              </div>
              {toast.description && (
                <div className="mt-0.5 text-[11px] text-zinc-400">
                  {toast.description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="rounded p-0.5 text-zinc-500 hover:text-zinc-200"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
