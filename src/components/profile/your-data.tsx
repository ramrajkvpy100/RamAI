"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { ClinicalEngineError, deleteAccount } from "@/lib/engine-client";
import { clearMe, type Me } from "@/lib/me-store";

/** The player's data rights, self-serve: a copy of everything, or delete it all. */
export function YourData({ me }: { me: Me }) {
  const router = useRouter();
  const guest = me.user.isGuest;
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setPassword("");
    setSure(false);
    setError(null);
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(guest ? undefined : password);
      clearMe();
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ClinicalEngineError && err.code !== "NETWORK" ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  const canDelete = sure && (guest || password.length > 0) && !busy;

  return (
    <section className="panel p-6" aria-labelledby="data-heading">
      <h2 id="data-heading" className="text-[16px] font-semibold">
        Your data
      </h2>
      <p className="mt-1 text-[13.5px] leading-6 text-fg-2">
        Download a copy of everything RamAI holds about you, or delete your account. See the{" "}
        <Link href="/privacy" className="font-medium text-accent-text hover:underline">
          privacy policy
        </Link>
        .
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href="/api/me/export" download className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-[13.5px] font-medium hover:bg-surface-3">
          <Icon name="file" size={15} className="text-fg-2" /> Download my data
        </a>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-[13.5px] font-medium text-danger hover:bg-danger-soft">
          <Icon name="x" size={15} /> Delete account
        </button>
      </div>

      <Sheet
        open={open}
        onClose={close}
        title="Delete your account?"
        placement="center"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} className="h-10 rounded-full px-4 text-[13.5px] font-medium text-fg-2 hover:text-fg">
              Cancel
            </button>
            <button type="button" onClick={() => void confirm()} disabled={!canDelete} className="h-10 rounded-full bg-danger px-4 text-[13.5px] font-semibold text-white disabled:opacity-50">
              {busy ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 px-5 py-4 text-[14px] leading-6 text-fg-2">
          <p>
            This deletes your account, cases, scores, streak and league history straight away. It can&apos;t be undone.
            {me.user.plan === "pro" && " Any Pro time left is lost too."}
          </p>
          {!guest && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-fg">Your password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl border border-line bg-surface px-3.5 text-[14px] text-fg outline-none focus:border-accent"
              />
            </label>
          )}
          <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px]">
            <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--danger)]" />
            <span>I understand my account and progress will be permanently deleted.</span>
          </label>
          {error && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {error}
            </p>
          )}
        </div>
      </Sheet>
    </section>
  );
}
