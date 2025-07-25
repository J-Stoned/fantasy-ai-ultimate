/**
 * Toast notification hook for user feedback
 */

import { useState, useCallback } from 'react';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
}

export interface ToastState {
  toasts: Toast[];
}

let toastCount = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    ({ title, description, variant = 'default' }: Omit<Toast, 'id'>) => {
      const id = (++toastCount).toString();
      const newToast: Toast = { id, title, description, variant };
      
      setToasts((prevToasts) => [...prevToasts, newToast]);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        setToasts((prevToasts) => prevToasts.filter((t) => t.id !== id));
      }, 5000);
      
      return { id };
    },
    []
  );

  const dismiss = useCallback((toastId?: string) => {
    setToasts((prevToasts) => 
      toastId 
        ? prevToasts.filter((t) => t.id !== toastId)
        : []
    );
  }, []);

  return {
    toast,
    dismiss,
    toasts,
  };
}