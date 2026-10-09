"use client";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

/** Ending a case is one confirmation, no forms: the debrief judges the diagnosis from the encounter itself. */
export function EndCaseDialog({ open, onClose, onConfirm, busy }: { open: boolean; onClose: () => void; onConfirm: () => void; busy?: boolean }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      placement="responsive"
      title="End case?"
      description="Your score and debrief follow. The case can't be reopened."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Keep working
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={busy} autoFocus>
            End case
          </Button>
        </div>
      }
    />
  );
}
