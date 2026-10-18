"use client";

import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/cn";

interface Board {
  code: string;
  name: string;
  members: { name: string; xp: number; average: number; cases: number; me: boolean }[];
}

/** Private leaderboards: your college, hospital or coaching class, ranked this week. */
export function GroupsCard() {
  const [groups, setGroups] = useState<Board[] | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/groups", { cache: "no-store" }).catch(() => null);
    setGroups(r?.ok ? ((await r.json()) as { groups: Board[] }).groups : []);
  }, []);
  useEffect(() => void load(), [load]);

  const act = async (body: object) => {
    setMsg(null);
    const r = await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { code?: string; error?: { message?: string } } | null;
    if (!r?.ok) return setMsg(j?.error?.message ?? "That didn't work — try again.");
    if (j?.code) setMsg(`Group made — share the code ${j.code} with your class.`);
    setName("");
    setCode("");
    void load();
  };

  return (
    <section className="panel p-5" aria-labelledby="groups-heading">
      <h2 id="groups-heading" className="text-[16px] font-semibold">👥 Private groups</h2>
      <p className="mt-1 text-[13px] text-fg-2">Your college, hospital or coaching class — ranked by this week&apos;s XP.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <form onSubmit={(e) => { e.preventDefault(); void act({ action: "create", name }); }} className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="New group name" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[14px]" />
          <button type="submit" disabled={name.trim().length < 2} className="h-10 rounded-full bg-accent px-4 text-[13px] font-semibold text-on-accent disabled:opacity-50">Create</button>
        </form>
        <form onSubmit={(e) => { e.preventDefault(); void act({ action: "join", code }); }} className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))} placeholder="Join with a code" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] tracking-[0.2em] uppercase" />
          <button type="submit" disabled={code.length !== 6} className="h-10 rounded-full border border-line px-4 text-[13px] font-semibold disabled:opacity-50">Join</button>
        </form>
      </div>
      {msg && <p className="mt-2 text-[13px] text-fg-2">{msg}</p>}
      {groups?.map((g) => (
        <div key={g.code} className="mt-4 rounded-xl border border-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-[14px] font-semibold">{g.name}</span>
            <span className="flex items-center gap-2 text-[12px] text-fg-3">
              code <b className="tracking-[0.15em] text-fg">{g.code}</b>
              <button type="button" onClick={() => void act({ action: "leave", code: g.code })} className="underline">leave</button>
            </span>
          </div>
          <ol>
            {g.members.map((m, i) => (
              <li key={`${m.name}-${i}`} className={cn("flex items-center justify-between px-4 py-2 text-[13.5px]", m.me && "bg-accent-soft")}>
                <span className="min-w-0 truncate"><span className="mr-2 text-fg-3 tabular">{i + 1}</span>{m.name}{m.me ? " (you)" : ""}</span>
                <span className="shrink-0 text-fg-2 tabular">{m.xp} XP · avg {m.average}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
