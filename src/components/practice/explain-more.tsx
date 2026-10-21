"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icon";

interface Teaching {
  findings: string;
  why: string;
  others: { option: string; why: string }[];
  next: string;
  pearl: string;
}

/** "Explain in detail" under a Skills Lab answer: what to look for, why, why not the others, what next, a pearl. */
export function ExplainMore({ drill, question, options, answer, explanation }: { drill: string; question: string; options: string[]; answer: string; explanation?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [teaching, setTeaching] = useState<Teaching | null>(null);

  const load = async () => {
    setState("loading");
    try {
      const res = await fetch("/api/practice/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drill, question: question.slice(0, 1500), options, answer, key: (explanation ?? "").slice(0, 3000) }),
      });
      const json = (await res.json()) as { teaching?: Teaching };
      if (!res.ok || !json.teaching) throw new Error();
      setTeaching(json.teaching);
      setState("idle");
    } catch {
      setState("error");
    }
  };

  if (teaching)
    return (
      <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-line bg-surface-2 p-4 text-[14px] leading-6">
        <Part title="What to look for" text={teaching.findings} />
        <Part title="Why it's this" text={teaching.why} />
        {teaching.others.length > 0 && (
          <div>
            <h4 className="text-[12px] font-semibold tracking-wide text-fg-3 uppercase">Why not the others</h4>
            <ul className="mt-1 flex flex-col gap-1">
              {teaching.others.map((o) => (
                <li key={o.option}>
                  <b className="font-semibold">{o.option}:</b> {o.why}
                </li>
              ))}
            </ul>
          </div>
        )}
        {teaching.next && <Part title="What to do next" text={teaching.next} />}
        {teaching.pearl && (
          <p className="rounded-xl bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-3 py-2 text-[13.5px]">
            <b className="font-semibold">Pearl:</b> {teaching.pearl}
          </p>
        )}
      </div>
    );

  return (
    <button
      type="button"
      onClick={() => void load()}
      disabled={state === "loading"}
      className="mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[13.5px] font-semibold text-accent-text hover:bg-surface-3 disabled:opacity-70"
    >
      <Icon name="book" size={15} />
      {state === "loading" ? "Writing the explanation…" : state === "error" ? "Couldn't load — tap to try again" : "Explain in detail"}
    </button>
  );
}

function Part({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h4 className="text-[12px] font-semibold tracking-wide text-fg-3 uppercase">{title}</h4>
      <p className="mt-1 whitespace-pre-line">{text}</p>
    </div>
  );
}
