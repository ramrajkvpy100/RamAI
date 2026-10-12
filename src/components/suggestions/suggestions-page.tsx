"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { CATEGORY_LABEL, mySuggestions, sendSuggestion, type Suggestion, type SuggestionCategory } from "@/lib/suggestions-client";

import { StatusPill, when } from "./status-pill";

const MAX = 2000;

/** Send a suggestion — no account needed — and see what happened to the ones you've sent. */
export function SuggestionsPage({ who }: { who: "account" | "guest" | "visitor" }) {
  const [category, setCategory] = useState<SuggestionCategory>("idea");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const anonymous = who !== "account";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [items, setItems] = useState<Suggestion[] | null>(null);

  useEffect(() => {
    if (who === "visitor") return setItems([]);
    mySuggestions()
      .then((r) => setItems(r.items))
      .catch((err) => {
        setItems([]);
        setError(err instanceof Error ? err.message : null);
      });
  }, [who]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { suggestion } = await sendSuggestion({
        category,
        message: message.trim(),
        page: "/suggestions",
        ...(anonymous && email.trim() ? { email: email.trim() } : {}),
      });
      setItems((list) => [suggestion, ...(list ?? [])]);
      setMessage("");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't send. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const length = message.trim().length;
  return (
    <div className="flex flex-col gap-5">
      <section className="panel p-5 sm:p-7" aria-labelledby="suggest-heading">
        <h1 id="suggest-heading" className="text-[26px] font-semibold tracking-[-0.02em]">
          Suggest an improvement
        </h1>
        <p className="mt-1.5 text-[14.5px] leading-6 text-fg-2">Ideas, problems, cases you&apos;d like to see — every one is read. No account needed.</p>

        {sent ? (
          <div role="status" className="mt-6 flex animate-enter items-start gap-3 rounded-2xl bg-success-soft p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success text-white">
              <Icon name="check" size={18} strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-fg">Thank you — it&apos;s with us.</div>
              <p className="mt-0.5 text-[13.5px] leading-5 text-fg-2">{who === "visitor" ? (email.trim() ? "We'll reply to your email." : "Every suggestion is read.") : "You'll see our answer below when we reply."}</p>
            </div>
            <button type="button" onClick={() => setSent(false)} className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold text-accent-text hover:bg-surface-3">
              Send another
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <div role="radiogroup" aria-label="Kind of suggestion" className="flex w-full flex-wrap gap-1 rounded-xl bg-surface-3 p-1 sm:w-auto sm:self-start">
              {(Object.keys(CATEGORY_LABEL) as SuggestionCategory[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={category === c}
                  onClick={() => setCategory(c)}
                  className={cn("h-8 flex-1 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap transition-colors sm:flex-none", category === c ? "bg-surface text-fg shadow-sm" : "text-fg-2 hover:text-fg")}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="sr-only">Your suggestion</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
                rows={5}
                required
                minLength={10}
                maxLength={MAX}
                placeholder={category === "problem" ? "What went wrong, and where?" : category === "case" ? "Which condition or situation would you like a case on?" : "What would make RamAI better for you?"}
                className="w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] leading-6 shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-accent-line focus:shadow-[0_0_0_3px_var(--accent-soft)]"
              />
              <span className={cn("self-end text-[12px] tabular", length > 0 && length < 10 ? "text-warning" : "text-fg-3")}>{length < 10 ? `${10 - length} more characters` : `${length.toLocaleString()} / ${MAX.toLocaleString()}`}</span>
            </label>
            {anonymous && (
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-fg-2">
                  Your email <span className="font-normal text-fg-3">(optional — so we can reply)</span>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.slice(0, 200))}
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-accent-line focus:shadow-[0_0_0_3px_var(--accent-soft)] sm:max-w-sm"
                />
              </label>
            )}
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger">
                <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}
            <button type="submit" disabled={busy || length < 10} className="bg-ai inline-flex h-11 items-center justify-center gap-2 self-start rounded-full px-6 text-[14.5px] font-semibold text-white shadow-glow transition-opacity disabled:opacity-50">
              {busy ? "Sending…" : "Send suggestion"} {!busy && <Icon name="send" size={14} />}
            </button>
          </form>
        )}
      </section>

      {who !== "visitor" && (
        <section className="panel p-5 sm:p-7" aria-labelledby="mine-heading">
          <h2 id="mine-heading" className="text-[17px] font-semibold">
            Your suggestions
          </h2>
          {items === null ? (
            <p className="mt-3 text-[14px] text-fg-3">Loading…</p>
          ) : items.length === 0 ? (
            <p className="mt-3 text-[14px] text-fg-2">Nothing yet. What would you change first?</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {items.map((s) => (
                <li key={s.id} className="rounded-2xl border border-line-2 bg-surface-2 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
                    <span className="font-medium text-fg-2">{CATEGORY_LABEL[s.category]}</span>
                    <span aria-hidden>·</span>
                    <span>{when(s.createdAt)}</span>
                    <StatusPill status={s.status} className="ml-auto" />
                  </div>
                  <p className="mt-2 text-[14.5px] leading-6 whitespace-pre-wrap">{s.message}</p>
                  {s.reply && (
                    <div className="mt-3 rounded-xl bg-accent-soft px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold tracking-[0.04em] text-accent-text uppercase">
                        RamAI replied
                        {s.repliedAt ? ` · ${when(s.repliedAt)}` : ""}
                      </div>
                      <p className="mt-1 text-[14px] leading-6 whitespace-pre-wrap text-fg">{s.reply}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
