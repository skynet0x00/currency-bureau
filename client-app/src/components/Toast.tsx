import { useState, useCallback, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';
export interface ToastMessage { id: string; type: ToastType; message: string; }

export function Toast({ toasts, onRemove }: { toasts: ToastMessage[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => <ToastItem key={t.id} toast={t} onRemove={onRemove} />)}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  useEffect(() => {
    const id = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(id);
  }, [toast.id, onRemove]);

  const colors: Record<ToastType, string> = {
    success: 'bg-emerald-500 text-white',
    error:   'bg-red-500 text-white',
    info:    'bg-blue-500 text-white',
  };
  const icons: Record<ToastType, string> = { success: '✓', error: '✕', info: 'ℹ' };

  return (
    <div
      style={{ animation: 'slideUp 0.25s ease-out' }}
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs ${colors[toast.type]}`}
    >
      <span className="font-bold">{icons[toast.type]}</span>
      <span className="flex-1">{toast.message}</span>
      <button onClick={() => onRemove(toast.id)} className="opacity-75 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
}

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
