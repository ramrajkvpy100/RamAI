"use client";

import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import type { InstallRoute } from "@/lib/app-install";

function Step({ n, icon, children }: { n: number; icon: IconName; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3.5 rounded-2xl bg-surface-2 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-accent-text shadow-sm">
        <Icon name={icon} size={18} />
      </span>
      <span className="text-[14px] leading-5">
        <span className="mr-1.5 text-fg-3 tabular">{n}.</span>
        {children}
      </span>
    </li>
  );
}

/** Apple's way to install: Safari has no button a page can offer, so here are the taps. */
export function InstallSheet({ route, open, onClose }: { route: InstallRoute; open: boolean; onClose: () => void }) {
  const mac = route === "mac-safari";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mac ? "Add RamAI to your Dock" : "Add RamAI to your Home Screen"}
      description="It opens full-screen like any other app — no app store needed."
      placement="responsive"
      footer={
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="bg-ai h-10 rounded-full px-5 text-[13.5px] font-semibold text-white">
            Got it
          </button>
        </div>
      }
    >
      <ol className="flex flex-col gap-2">
        {mac ? (
          <>
            <Step n={1} icon="menu">
              In Safari&apos;s menu bar, choose <b>File</b>.
            </Step>
            <Step n={2} icon="plus-square">
              Choose <b>Add to Dock…</b>, then <b>Add</b>.
            </Step>
          </>
        ) : (
          <>
            <Step n={1} icon="share-ios">
              Tap <b>Share</b> in Safari — on newer iPhones it&apos;s inside the <b>•••</b> menu.
            </Step>
            <Step n={2} icon="plus-square">
              Tap <b>Add to Home Screen</b> (scroll down if you don&apos;t see it).
            </Step>
            <Step n={3} icon="device">
              Tap <b>Add</b>, then open RamAI from your Home Screen.
            </Step>
          </>
        )}
      </ol>
      {!mac && <p className="mt-4 text-[12.5px] leading-5 text-fg-3">Daily reminders on iPhone and iPad work in the Home Screen app (iOS 16.4 or later): turn them on from its menu.</p>}
    </Sheet>
  );
}
