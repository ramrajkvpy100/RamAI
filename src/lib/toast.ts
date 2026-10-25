/**
 * Toasts — the app's one way to say "that worked" (and, for anything that can be taken back, offer Undo).
 * A tiny store: any component calls `toast(...)`; <Toaster /> in the layout shows them.
 */
export type ToastTone = "success" | "info" | "warning" | "danger";

export interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
  /** "Undo" (or another short action) and what it does. */
  action?: { label: string; run: () => void };
  /** How long it stays, in ms. */
  ms: number;
}

let seq = 0;
let list: Toast[] = [];
const subs = new Set<(t: Toast[]) => void>();
const emit = () => subs.forEach((f) => f(list));

export function dismissToast(id: number) {
  list = list.filter((t) => t.id !== id);
  emit();
}

export function toast(text: string, opts: { tone?: ToastTone; action?: Toast["action"]; ms?: number } = {}): number {
  const t: Toast = { id: ++seq, text, tone: opts.tone ?? "success", ms: opts.ms ?? (opts.action ? 6000 : 3200), ...(opts.action ? { action: opts.action } : {}) };
  list = [...list.slice(-2), t];
  emit();
  setTimeout(() => dismissToast(t.id), t.ms);
  return t.id;
}

/**
 * Something that can be taken back: it is shown as done at once, and really happens only when the Undo window
 * closes without Undo being tapped. Returns nothing; `undo` puts the screen back.
 */
export function withUndo(text: string, commit: () => void | Promise<void>, undo: () => void, ms = 6000) {
  let undone = false;
  const id = toast(text, { tone: "info", ms, action: { label: "Undo", run: () => { undone = true; undo(); dismissToast(id); toast("Undone", { tone: "info", ms: 1800 }); } } });
  setTimeout(() => { if (!undone) void commit(); }, ms);
}

export function subscribeToasts(f: (t: Toast[]) => void): () => void {
  subs.add(f);
  f(list);
  return () => subs.delete(f);
}
