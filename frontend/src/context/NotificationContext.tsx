import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@/components/ui';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Trash2,
  HelpCircle,
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'primary';
}

export interface AlertModalOptions {
  title?: string;
  message: string;
  buttonText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'primary';
}

interface NotificationContextType {
  // Toasts / Snackbars
  toast: {
    success: (message: string, title?: string, duration?: number) => void;
    error: (message: string, title?: string, duration?: number) => void;
    warning: (message: string, title?: string, duration?: number) => void;
    info: (message: string, title?: string, duration?: number) => void;
    remove: (id: string) => void;
  };
  notify: {
    success: (message: string, title?: string, duration?: number) => void;
    error: (message: string, title?: string, duration?: number) => void;
    warning: (message: string, title?: string, duration?: number) => void;
    info: (message: string, title?: string, duration?: number) => void;
    remove: (id: string) => void;
  };
  // Confirmation Modal (Promise-based)
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  // Alert Modal (Promise-based)
  alertModal: (options: AlertModalOptions) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Toast state
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Confirmation modal state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve?: (value: boolean) => void;
  }>({
    open: false,
    options: { message: '' },
  });

  // Alert modal state
  const [alertState, setAlertState] = useState<{
    open: boolean;
    options: AlertModalOptions;
    resolve?: () => void;
  }>({
    open: false,
    options: { message: '' },
  });

  // Toast dispatchers
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, title?: string, duration = 4000) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toastMethods = {
    success: (msg: string, title?: string, duration?: number) =>
      addToast('success', msg, title, duration),
    error: (msg: string, title?: string, duration?: number) =>
      addToast('error', msg, title, duration || 5000),
    warning: (msg: string, title?: string, duration?: number) =>
      addToast('warning', msg, title, duration),
    info: (msg: string, title?: string, duration?: number) =>
      addToast('info', msg, title, duration),
    remove: removeToast,
  };

  // Confirm Modal dispatcher
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        open: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirmClose = (result: boolean) => {
    if (confirmState.resolve) {
      confirmState.resolve(result);
    }
    setConfirmState((prev) => ({ ...prev, open: false }));
  };

  // Alert Modal dispatcher
  const alertModal = useCallback((options: AlertModalOptions): Promise<void> => {
    return new Promise((resolve) => {
      setAlertState({
        open: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleAlertClose = () => {
    if (alertState.resolve) {
      alertState.resolve();
    }
    setAlertState((prev) => ({ ...prev, open: false }));
  };

  return (
    <NotificationContext.Provider
      value={{
        toast: toastMethods,
        notify: toastMethods,
        confirm,
        alertModal,
      }}
    >
      {children}

      {/* FLOATING TOASTS / SNACKBAR CONTAINER */}
      <div
        className="fixed bottom-5 start-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
        dir="rtl"
      >
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-3.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-5 flex items-start gap-3 text-right ${
                isSuccess
                  ? 'bg-card/95 border-emerald-500/30 text-card-foreground ring-1 ring-emerald-500/20'
                  : isError
                  ? 'bg-card/95 border-rose-500/30 text-card-foreground ring-1 ring-rose-500/20'
                  : isWarning
                  ? 'bg-card/95 border-amber-500/30 text-card-foreground ring-1 ring-amber-500/20'
                  : 'bg-card/95 border-blue-500/30 text-card-foreground ring-1 ring-blue-500/20'
              }`}
            >
              <div className="shrink-0 pt-0.5">
                {isSuccess && (
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
                {isError && (
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                )}
                {isWarning && (
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                )}
                {t.type === 'info' && (
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <Info className="w-4 h-4" />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-0.5">
                {t.title && <h4 className="text-xs font-bold text-foreground">{t.title}</h4>}
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                  {t.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-muted-foreground/60 hover:text-foreground p-1 rounded-lg transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* UNIFIED CONFIRMATION MODAL */}
      <Dialog
        open={confirmState.open}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleConfirmClose(false);
        }}
      >
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <div className="flex items-center gap-2.5 mb-1">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmState.options.variant === 'danger'
                    ? 'bg-rose-500/10 text-rose-600'
                    : confirmState.options.variant === 'warning'
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                {confirmState.options.variant === 'danger' ? (
                  <Trash2 className="w-5 h-5" />
                ) : confirmState.options.variant === 'warning' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <HelpCircle className="w-5 h-5" />
                )}
              </div>
              <DialogTitle className="text-base font-bold text-foreground">
                {confirmState.options.title || 'تأكيد الإجراء'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-2 text-right">
              {confirmState.options.message}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleConfirmClose(false)}
              className="text-xs font-bold"
            >
              {confirmState.options.cancelText || 'إلغاء'}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleConfirmClose(true)}
              className={`text-xs font-bold ${
                confirmState.options.variant === 'danger'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                  : confirmState.options.variant === 'warning'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs'
              }`}
            >
              {confirmState.options.confirmText || 'تأكيد'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UNIFIED ALERT MODAL */}
      <Dialog
        open={alertState.open}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleAlertClose();
        }}
      >
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <div className="flex items-center gap-2.5 mb-1">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  alertState.options.variant === 'danger'
                    ? 'bg-rose-500/10 text-rose-600'
                    : alertState.options.variant === 'warning'
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                {alertState.options.variant === 'danger' ? (
                  <AlertCircle className="w-5 h-5" />
                ) : alertState.options.variant === 'warning' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>
              <DialogTitle className="text-base font-bold text-foreground">
                {alertState.options.title || 'تنبيه'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-2 text-right">
              {alertState.options.message}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-3">
            <Button
              type="button"
              size="sm"
              onClick={handleAlertClose}
              className="text-xs font-bold"
            >
              {alertState.options.buttonText || 'حسناً'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </NotificationContext.Provider>
  );
};

export const useNotify = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotify must be used within a NotificationProvider');
  }
  return ctx;
};

export const useToast = () => {
  const ctx = useNotify();
  return ctx.toast;
};

export const useConfirm = () => {
  const ctx = useNotify();
  return ctx.confirm;
};
