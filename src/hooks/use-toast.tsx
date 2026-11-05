import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useId,
  useRef,
  useEffect,
} from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
  confirm: (message: string) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 6000;

const toastStyles: Record<ToastType, { bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    bg: "bg-green-50 dark:bg-green-950",
    border: "border-green-200 dark:border-green-800",
    icon: <CheckCircle aria-hidden="true" className="h-5 w-5 text-green-600 dark:text-green-400" />,
  },
  error: {
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-200 dark:border-red-800",
    icon: <AlertCircle aria-hidden="true" className="h-5 w-5 text-red-600 dark:text-red-400" />,
  },
  warning: {
    bg: "bg-yellow-50 dark:bg-yellow-950",
    border: "border-yellow-200 dark:border-yellow-800",
    icon: (
      <AlertTriangle aria-hidden="true" className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
    ),
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-950",
    border: "border-blue-200 dark:border-blue-800",
    icon: <Info aria-hidden="true" className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
  },
};

interface ConfirmState {
  message: string;
  resolve: (value: boolean) => void;
}

const FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * Modal confirmation. Focus starts on the safe choice (Cancel), Tab stays inside,
 * Escape cancels, and focus goes back to where it was when the dialog closes.
 */
function ConfirmDialog({
  message,
  onResolve,
}: {
  message: string;
  onResolve: (v: boolean) => void;
}) {
  const messageId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => {
      // Only restore when focus was lost (e.g. the opener was removed would leave it on <body>
      // only if nothing else claimed it): never steal focus someone moved on purpose.
      if (document.activeElement === document.body || document.activeElement === null) {
        previous?.focus?.();
      }
    };
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onResolve(false);
      return;
    }
    if (event.key !== "Tab") return;
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden="true"
        onClick={() => onResolve(false)}
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={messageId}
        onKeyDown={onKeyDown}
        className="relative bg-background border rounded-lg shadow-xl p-6 max-w-md mx-4 animate-in zoom-in-95 duration-200"
      >
        <p id={messageId} className="text-foreground mb-6">
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={() => onResolve(false)}
            className="px-4 py-2 text-sm border rounded-md hover:bg-secondary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Cancel
          </button>
          <button
            onClick={() => onResolve(true)}
            className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup all timeouts on unmount to prevent memory leaks
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const schedule = useCallback(
    (id: string, duration: number) => {
      if (duration <= 0) return;
      timeoutsRef.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss],
  );

  // A toast must not vanish while it is being read: hovering or focusing it pauses the timer.
  const pause = useCallback((id: string) => {
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string, duration = DEFAULT_DURATION) => {
      const id = crypto.randomUUID();
      setToasts((prev) =>
        // The same message twice in a row is announced once and shown once.
        prev.some((t) => t.type === type && t.message === message)
          ? prev
          : [...prev, { id, type, message, duration }],
      );
      schedule(id, duration);
    },
    [schedule],
  );

  const success = useCallback((message: string) => toast("success", message), [toast]);
  // Errors stay until dismissed: they need a decision, not a glance.
  const error = useCallback((message: string) => toast("error", message, 0), [toast]);
  const warning = useCallback((message: string) => toast("warning", message), [toast]);
  const info = useCallback((message: string) => toast("info", message), [toast]);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ message, resolve });
    });
  }, []);

  const handleConfirm = useCallback(
    (value: boolean) => {
      if (confirmState) {
        confirmState.resolve(value);
        setConfirmState(null);
      }
    },
    [confirmState],
  );

  const renderToast = (t: Toast) => {
    const style = toastStyles[t.type];
    return (
      <div
        key={t.id}
        onMouseEnter={() => pause(t.id)}
        onMouseLeave={() => schedule(t.id, t.duration ?? 0)}
        onFocus={() => pause(t.id)}
        onBlur={() => schedule(t.id, t.duration ?? 0)}
        className={`${style.bg} ${style.border} border rounded-lg shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-right-full duration-300`}
      >
        {style.icon}
        <p className="flex-1 text-sm text-foreground whitespace-pre-wrap">{t.message}</p>
        <button
          onClick={() => dismiss(t.id)}
          aria-label="Dismiss notification"
          className="-m-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <ToastContext.Provider
      value={{ toasts, toast, success, error, warning, info, dismiss, confirm }}
    >
      {children}

      {/* Always mounted so screen readers announce what is added: polite for news, assertive for errors. */}
      <section
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md"
      >
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          {toasts.filter((t) => t.type !== "error").map(renderToast)}
        </div>
        <div role="alert" className="flex flex-col gap-2">
          {toasts.filter((t) => t.type === "error").map(renderToast)}
        </div>
      </section>

      {confirmState && <ConfirmDialog message={confirmState.message} onResolve={handleConfirm} />}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
