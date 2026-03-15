import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id:      string;
  type:    ToastType;
  message: string;
}

interface Props {
  toasts:   ToastMessage[];
  onRemove: (id: string) => void;
}

export function Toast({ toasts, onRemove }: Props) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  useEffect(() => {
    const id = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(id);
  }, [toast.id, onRemove]);

  const base = 'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up max-w-sm';
  const styles: Record<ToastType, string> = {
    success: `${base} bg-emerald-500 text-white`,
    error:   `${base} bg-red-500 text-white`,
    info:    `${base} bg-blue-500 text-white`,
  };
  const icons: Record<ToastType, string> = { success: '✓', error: '✕', info: 'ℹ' };

  return (
    <div className={styles[toast.type]}>
      <span className="text-lg leading-none">{icons[toast.type]}</span>
      <span>{toast.message}</span>
      <button onClick={() => onRemove(toast.id)} className="ml-auto opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}

// Hook
import { useState, useCallback } from 'react';

let _id = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const push = useCallback((type: ToastType, message: string) => {
    const id = String(++_id);
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, push, remove };
}
