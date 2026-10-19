"use client";

import { useCallback, useEffect, useState } from "react";

interface Data {
  codes: { code: string; label: string; max_uses: number; uses: number; revoked: number; created_at: number }[];
  emails: { email: string; added_at: number }[];
}

/** Make invite codes (one per friend, or one for a group), revoke them, and allow emails. */
export function InviteAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [label, setLabel] = useState("");
  const [count, setCount] = useState(5);
  const [uses, setUses] = useState(1);
  const [email, setEmail] = useState("");
  const [fresh, setFresh] = useState<string[]>([]);
  const load = useCallback(async () => {
    const r = await fetch("/api/access/admin", { cache: "no-store" });
    if (r.ok) setData((await r.json()) as Data);
  }, []);
  useEffect(() => void load(), [load]);
  const post = async (body: object) => {
    const r = await fetch("/api/access/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => null)) as { codes?: string[] } | null;
    if (j?.codes) setFresh(j.codes);
    void load();
  };
  const link = (code: string) => `${window.location.origin}/invite — code ${code}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 py-6">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Invites</h1>
      <section className="panel flex flex-col gap-3 p-5">
        <h2 className="text-[16px] font-semibold">Make invite codes</h2>
        <p className="text-[13px] text-fg-2">One code per friend (1 use), or one code for a group (more uses). Each code makes one account per use.</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_90px_90px_auto]">
          <input value={label} onChange={(e) => setLabel(e.target.value.slice(0, 60))} placeholder="Who for, e.g. 'AIIMS friends'" className="h-10 rounded-xl border border-line bg-surface px-3 text-[14px]" />
          <label className="flex items-center gap-1 text-[12px] text-fg-2">codes <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-10 w-14 rounded-xl border border-line bg-surface px-2 text-[14px]" /></label>
          <label className="flex items-center gap-1 text-[12px] text-fg-2">uses <input type="number" min={1} max={500} value={uses} onChange={(e) => setUses(Number(e.target.value))} className="h-10 w-14 rounded-xl border border-line bg-surface px-2 text-[14px]" /></label>
          <button type="button" disabled={!label.trim()} onClick={() => void post({ action: "codes", count, label: label.trim(), maxUses: uses })} className="h-10 rounded-full bg-accent px-4 text-[13.5px] font-semibold text-on-accent disabled:opacity-50">Make</button>
        </div>
        {fresh.length > 0 && (
          <div className="rounded-xl bg-surface-2 p-3">
            <div className="text-[12px] font-semibold text-fg-2">New codes — send one to each friend:</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {fresh.map((c) => (
                <button key={c} type="button" onClick={() => void navigator.clipboard?.writeText(link(c))} className="rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-[14px] tracking-[0.15em]" title="Copy">
                  {c}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-fg-3">Tap a code to copy it with the site link.</p>
          </div>
        )}
      </section>

      <section className="panel p-5">
        <h2 className="text-[16px] font-semibold">Allowed emails</h2>
        <p className="mt-1 text-[13px] text-fg-2">These can sign up or sign in without a code.</p>
        <form onSubmit={(e) => { e.preventDefault(); void post({ action: "allow", email }); setEmail(""); }} className="mt-3 flex gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="friend@example.com" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[14px]" />
          <button type="submit" className="h-10 rounded-full bg-accent px-4 text-[13.5px] font-semibold text-on-accent">Allow</button>
        </form>
        <ul className="mt-3 divide-y divide-line">
          {data?.emails.map((e) => (
            <li key={e.email} className="flex items-center justify-between py-2 text-[14px]">
              {e.email}
              <button type="button" onClick={() => void post({ action: "remove", email: e.email })} className="text-[12.5px] text-danger underline">remove</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel p-5">
        <h2 className="text-[16px] font-semibold">Codes</h2>
        <ul className="mt-3 divide-y divide-line">
          {data?.codes.map((c) => (
            <li key={c.code} className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
              <span className="font-mono tracking-[0.12em]">{c.code}</span>
              <span className="min-w-0 flex-1 truncate text-fg-2">{c.label}</span>
              <span className="tabular text-fg-2">{c.uses}/{c.max_uses}</span>
              {c.revoked ? <span className="text-fg-3">revoked</span> : <button type="button" onClick={() => void post({ action: "revoke", code: c.code })} className="text-[12.5px] text-danger underline">revoke</button>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
