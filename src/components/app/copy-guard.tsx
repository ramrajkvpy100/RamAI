"use client";

import { useEffect } from "react";

/** No right-click "Save image" on pictures, scans or tracings; no dragging them out. Text fields are left alone. */
export function CopyGuard() {
  useEffect(() => {
    const media = (t: EventTarget | null) => t instanceof Element && !!t.closest("img, canvas, video, svg, figure");
    const onMenu = (e: MouseEvent) => media(e.target) && e.preventDefault();
    const onDrag = (e: DragEvent) => media(e.target) && e.preventDefault();
    document.addEventListener("contextmenu", onMenu);
    document.addEventListener("dragstart", onDrag);
    return () => {
      document.removeEventListener("contextmenu", onMenu);
      document.removeEventListener("dragstart", onDrag);
    };
  }, []);
  return null;
}
