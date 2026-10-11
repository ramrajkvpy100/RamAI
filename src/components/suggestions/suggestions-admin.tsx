"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import {
  adminSuggestions,
  answerSuggestion,
  CATEGORY_LABEL,
  removeSuggestion,
  STATUS_LABEL,
  type StatusCounts,
  type Suggestion,
  type SuggestionCategory,
  type SuggestionStatus,
} from "@/lib/suggestions-client";

import { StatusPill, when } from "./status-pill";

const STATUSES = Object.keys(STATUS_LABEL) as SuggestionStatus[];

/** One suggestion: what was sent, by whom, and the admin's answer. */
function Item({ s, onChanged, onRemoved }: { s: Suggestion; onChanged: (s: Suggestion) => void; onRemoved: (id: string) => void }) {
  const [reply, setReply] = useState(s.reply ?? "");
  const [status, setStatus] = useState<SuggestionStatus>(s.status);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = reply.trim() !== (s.reply ?? "") || status !== s.status;

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      const { suggestion } = await answerSuggestion(s.id, { status, ...(reply.trim() !== (s.reply ?? "") ? { reply: reply.trim() || null } : {}) });
      onChanged(suggestion);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save.");
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    setBusy("delete");
    setError(null);
    try {
      await removeSuggestion(s.id);
      onRemoved(s.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't delete.");
      setBusy(null);
    }
  };

  return (
    <li className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-fg-3">
        <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11.5px] font-semibold text-fg-2">{CATEGORY_LABEL[s.category]}</span>
        <span className="font-medium text-fg-2">{s.name}</span>
        <a href={`mailto:${s.email}`} className="truncate hover:text-fg hover:underline">
          {s.email}
        </a>
        <span aria-hidden>·</span>
        <span>{when(s.createdAt)}</span>
        {s.page && <span className="hidden sm:inline">· from {s.page}</span>}
        <StatusPill status={s.status} className="ml-auto" />
      </div>
      <p className="mt-2.5 text-[15px] leading-6 whitespace-pre-wrap">{s.message}</p>

      <div className="mt-4 flex flex-col gap-2.5 border-t border-line-2 pt-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-fg-2">Your answer {s.repliedAt && <span className="font-normal text-fg-3">· sent {when(s.repliedAt)}</span>}</span>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value.slice(0, 2000))}
            rows={2}
            placeholder="Shown to the player on their Suggestions page."
            className="w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-6 outline-none focus:border-accent-line focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SuggestionStatus)}
            aria-label="Status"
            className="h-9 rounded-full border border-line bg-surface px-3 text-[13px] font-medium outline-none focus:border-accent-line"
          >
            {STATUSES.map((st) => (
              <option key={st} value={st}>
                {STATUS_LABEL[st]}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void save()} disabled={!dirty || busy !== null} className="bg-ai inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-white disabled:opacity-40">
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          {saved && (
            <span role="status" className="flex items-center gap-1 text-[12.5px] font-medium text-success">
              <Icon name="check" size={13} strokeWidth={2.4} /> Saved
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            {confirm ? (
              <>
                <span className="text-[12.5px] text-fg-2">Delete for good?</span>
                <button type="button" onClick={() => void remove()} disabled={busy !== null} className="h-8 rounded-full bg-danger px-3 text-[12.5px] font-semibold text-white disabled:opacity-50">
                  {busy === "delete" ? "Deleting…" : "Delete"}
                </button>
                <button type="button" onClick={() => setConfirm(false)} className="h-8 rounded-full px-2.5 text-[12.5px] font-medium text-fg-2 hover:text-fg">
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirm(true)} className="flex h-8 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-medium text-fg-3 hover:bg-danger-soft hover:text-danger">
                <Icon name="x" size={13} /> Delete
              </button>
            )}
          </span>
        </div>
        {error && (
          <p role="alert" className="text-[12.5px] text-danger">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}

/** Every suggestion, newest first: filter by status or kind, search, answer, tidy up. */
export function SuggestionsAdmin({ initial }: { initial: { items: Suggestion[]; counts: StatusCounts } | { error: string } }) {
  const [items, setItems] = useState<Suggestion[]>("items" in initial ? initial.items : []);
  const [counts, setCounts] = useState<StatusCounts | null>("counts" in initial ? initial.counts : null);
  const [status, setStatus] = useState<SuggestionStatus | "">("");
  const [category, setCategory] = useState<SuggestionCategory | "">("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>("error" in initial ? initial.error : null);
  const [first, setFirst] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminSuggestions({ status: status || undefined, category: category || undefined, q: q.trim() || undefined });
      setItems(r.items);
      setCounts(r.counts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load suggestions.");
    } finally {
      setLoading(false);
    }
  }, [status, category, q]);

  useEffect(() => {
    if (first) return setFirst(false);
    const t = window.setTimeout(() => void load(), q ? 300 : 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, category, q]);

  const tabs = useMemo(() => [{ id: "" as const, label: "All", n: counts?.all }, ...STATUSES.map((s) => ({ id: s, label: STATUS_LABEL[s], n: counts?.[s] }))], [counts]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="micro text-accent-text">Admin</div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.02em]">Suggestions</h1>
          <p className="mt-1 text-[14px] text-fg-2">{counts ? `${counts.all} in total · ${counts.new} new` : "From players, stored in Supabase."}</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13px] font-medium hover:bg-surface-3 disabled:opacity-60">
          <Icon name="refresh" size={14} className={cn(loading && "animate-spin")} /> Refresh
        </button>
      </header>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div role="tablist" aria-label="Status" className="flex gap-1 overflow-x-auto rounded-xl bg-surface-3 p-1 [scrollbar-width:none]">
          {tabs.map((t) => (
            <button
              key={t.id || "all"}
              type="button"
              role="tab"
              aria-selected={status === t.id}
              onClick={() => setStatus(t.id)}
              className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap", status === t.id ? "bg-surface text-fg shadow-sm" : "text-fg-2 hover:text-fg")}
            >
              {t.label}
              {t.n !== undefined && <span className="text-[11.5px] text-fg-3 tabular">{t.n}</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <select value={category} onChange={(e) => setCategory(e.target.value as SuggestionCategory | "")} aria-label="Kind" className="h-9 rounded-full border border-line bg-surface px-3 text-[13px] outline-none">
            <option value="">All kinds</option>
            {(Object.keys(CATEGORY_LABEL) as SuggestionCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value.slice(0, 100))}
            placeholder="Search"
            aria-label="Search suggestions"
            className="h-9 w-full min-w-0 rounded-full border border-line bg-surface px-3.5 text-[13px] outline-none focus:border-accent-line sm:w-48"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger">
          <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="panel p-8 text-center text-[14.5px] text-fg-2">{loading ? "Loading…" : q || status || category ? "Nothing matches." : "No suggestions yet."}</div>
      ) : (
        <ul className={cn("flex flex-col gap-3 transition-opacity", loading && "opacity-60")}>
          {items.map((s) => (
            <Item
              key={s.id}
              s={s}
              onChanged={(next) => {
                setItems((list) => list.map((x) => (x.id === next.id ? next : x)));
                void load();
              }}
              onRemoved={(id) => {
                setItems((list) => list.filter((x) => x.id !== id));
                void load();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
