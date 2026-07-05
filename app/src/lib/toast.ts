/** Tiny framework-free toast store. Lives outside React so non-component code
 *  (lib/writes.ts) can raise a toast the moment a contract reverts, without
 *  threading a hook through every view. A single <Toaster/> subscribes and
 *  renders. The tx ladder stays the record of settlement (FR-7.2); toasts are
 *  the loud channel for contract errors the user must read. */

export type ToastKind = "error" | "warn" | "info" | "success";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  /** ms before auto-dismiss; 0 = sticky (errors stay until dismissed). */
  ttl: number;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<Listener>();

function emit() {
  const snapshot = toasts;
  listeners.forEach((l) => l(snapshot));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function push(t: Omit<Toast, "id">): number {
  const id = ++seq;
  toasts = [...toasts, { ...t, id }];
  emit();
  if (t.ttl > 0) {
    setTimeout(() => dismiss(id), t.ttl);
  }
  return id;
}

/** Convenience raisers. Every toast auto-dismisses; errors get the longest
 *  window (a reverted transaction is not something to blink and miss) but still
 *  clear on their own. Any toast can be dismissed early by clicking it. */
export const toast = {
  error: (title: string, message?: string) => push({ kind: "error", title, message, ttl: 10000 }),
  warn: (title: string, message?: string) => push({ kind: "warn", title, message, ttl: 8000 }),
  info: (title: string, message?: string) => push({ kind: "info", title, message, ttl: 6000 }),
  success: (title: string, message?: string) =>
    push({ kind: "success", title, message, ttl: 5000 }),
};
