import { useState, useCallback } from 'react';
import type { ToastType, ToastMessage } from '../components/Toast';

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
