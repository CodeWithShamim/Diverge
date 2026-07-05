import { useEffect, useState } from "react";
import { subscribe, dismiss, type Toast } from "../lib/toast";

/** The single toast host — mount once, near the app root. Subscribes to the
 *  framework-free toast store so any layer (including non-React lib/writes.ts)
 *  can surface a contract error the moment it happens. */
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribe(setToasts), []);

  if (!toasts.length) return null;

  return (
    <div className="toaster" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role="alert" aria-live="assertive">
          <div className="toast-body">
            <p className="toast-title">{t.title}</p>
            {t.message && <p className="toast-message">{t.message}</p>}
          </div>
          <button
            className="toast-close"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
