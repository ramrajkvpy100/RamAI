"use client";

import { useState } from "react";

import { FillingBar } from "@/components/ui/filling-bar";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

interface Explainer {
  name: string;
  overview: string;
  cause: string;
  mechanism: string;
  presentation: string[];
  diagnosis: string[];
  treatment: string[];
  complications: string[];
  prognosis: string;
  remember: string[];
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="micro text-fg-2">{title}</h4>
      {children}
    </section>
  );
}

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="flex flex-col gap-1.5 text-[14.5px] leading-6">
    {items.map((x) => (
      <li key={x} className="flex gap-2.5">
        <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
        {x}
      </li>
    ))}
  </ul>
);

/** After the case: the disease itself, explained — opened on request. */
export function DiseaseSection({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Explainer | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || data !== undefined || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/cases/disease", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const json = (await res.json().catch(() => null)) as { disease?: Explainer | null } | null;
      setData(res.ok ? (json?.disease ?? null) : null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-10" aria-labelledby="disease-heading">
      <button type="button" onClick={() => void toggle()} aria-expanded={open} className="panel flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-2">
        <span className="flex items-center gap-3">
          <span className="bg-ai flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white">
            <Icon name="book" size={17} />
          </span>
          <span>
            <span id="disease-heading" className="block text-[15px] font-semibold">
              Understand this disease
            </span>
            <span className="block text-[13px] text-fg-2">What it is, why it happens, how it presents, is confirmed and treated</span>
          </span>
        </span>
        <Icon name="chevron-down" size={18} className={cn("shrink-0 text-fg-2 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="panel mt-3 animate-enter p-5 sm:p-6">
          {loading ? (
            <div role="status" className="flex flex-col gap-3 text-[14px] text-fg-2">
              Explaining the disease…
              <FillingBar active expectedMs={20_000} label="Explaining the disease" />
            </div>
          ) : !data ? (
            <p className="text-[14px] text-fg-2">The explanation isn&apos;t available just now. Please try again in a moment.</p>
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="text-[20px] font-semibold tracking-[-0.01em]">{data.name}</h3>
                <p className="mt-2 text-[15px] leading-7">{data.overview}</p>
              </div>
              <Part title="Cause">
                <p className="text-[14.5px] leading-7">{data.cause}</p>
              </Part>
              <Part title="What goes wrong">
                <p className="text-[14.5px] leading-7">{data.mechanism}</p>
              </Part>
              {data.presentation.length > 0 && (
                <Part title="How it presents">
                  <Bullets items={data.presentation} />
                </Part>
              )}
              {data.diagnosis.length > 0 && (
                <Part title="Confirming it">
                  <Bullets items={data.diagnosis} />
                </Part>
              )}
              {data.treatment.length > 0 && (
                <Part title="Treatment">
                  <Bullets items={data.treatment} />
                </Part>
              )}
              {data.complications.length > 0 && (
                <Part title="Complications">
                  <Bullets items={data.complications} />
                </Part>
              )}
              {data.prognosis && (
                <Part title="Outlook">
                  <p className="text-[14.5px] leading-7">{data.prognosis}</p>
                </Part>
              )}
              {data.remember.length > 0 && (
                <div className="rounded-xl bg-warning-soft p-4">
                  <h4 className="flex items-center gap-2 text-[14px] font-semibold">
                    <Icon name="bulb" size={15} className="text-warning" /> Remember
                  </h4>
                  <div className="mt-2">
                    <Bullets items={data.remember} />
                  </div>
                </div>
              )}
              <p className="text-[11.5px] text-fg-3">Written by AI for learning — check against standard textbooks and guidelines.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
