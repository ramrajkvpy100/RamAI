"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { IconButton } from "./button";
import { Icon } from "./icon";

/**
 * Accessible modal surface built on the native <dialog>: focus is trapped,
 * Escape closes, the page behind is inert.
 *   bottom — a bottom sheet (phones), right — a side drawer, center — a dialog.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  placement = "bottom",
  className,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Omit for a plain confirmation: title, description and footer. */
  children?: ReactNode;
  placement?: "bottom" | "right" | "center" | "responsive";
  className?: string;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Content stays mounted while the sheet animates away.
  const [shown, setShown] = useState(open);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      el.removeAttribute("data-closing");
      setShown(true);
      if (!el.open) el.showModal();
      return;
    }
    if (!el.open) return;
    const finish = () => {
      el.removeAttribute("data-closing");
      el.close();
      setShown(false);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();
    el.setAttribute("data-closing", "");
    const timer = window.setTimeout(finish, 190);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);

  const layout = {
    bottom: "mt-auto mb-0 w-full max-w-none rounded-t-[18px] max-h-[86dvh]",
    right: "ml-auto mr-0 h-dvh max-h-dvh w-full max-w-[420px] rounded-none",
    center: "m-auto w-[calc(100%-32px)] max-w-[480px] rounded-xl max-h-[86dvh]",
    responsive: "mt-auto mb-0 w-full max-w-none rounded-t-[18px] max-h-[86dvh] sm:m-auto sm:w-[calc(100%-32px)] sm:max-w-[520px] sm:rounded-xl",
  }[placement];

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "material-thick p-0 text-fg backdrop:bg-[rgb(0_0_0/0.2)] backdrop:backdrop-blur-[6px] open:flex open:flex-col open:animate-sheet",
        layout,
        className,
      )}
    >
      {(open || shown) && (
        <>
          <header className="flex items-start justify-between gap-4 border-b border-line-2 px-5 pt-4 pb-3">
            <div className="min-w-0">
              {placement !== "center" && <div aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-line sm:hidden" />}
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
              {description && <p className="mt-0.5 text-ui text-fg-2">{description}</p>}
            </div>
            <IconButton label="Close" size="sm" onClick={onClose} className="-mr-1.5 mt-0.5">
              <Icon name="x" />
            </IconButton>
          </header>
          {children != null && <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>}
          {footer && <footer className={cn("px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]", children != null && "border-t border-line-2")}>{footer}</footer>}
        </>
      )}
    </dialog>
  );
}
