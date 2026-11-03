import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { publicCredential } from "@/server/certificate";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clinical credential", robots: { index: false, follow: false } };

const row = (label: string, value: number | null) => (
  <div key={label} className="flex items-baseline justify-between gap-3 border-b border-line py-2.5 text-[14.5px]">
    <span className="text-fg-2">{label}</span>
    <span className="font-semibold tabular">{value === null ? "Not enough cases" : `${value}%`}</span>
  </div>
);

/** A doctor's public credential, while they keep the link on. */
export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{8,20}$/.test(id)) notFound();
  const c = await publicCredential(id).catch(() => null);
  if (!c) notFound();
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12">
      <p className="text-[12px] font-semibold tracking-[0.12em] text-fg-3 uppercase">RamAI clinical credential</p>
      <h1 className="mt-2 text-[28px] font-bold tracking-[-0.02em]">{c.name}</h1>
      <p className="mt-1 text-[15px] text-fg-2">
        {c.rank}{c.top !== null ? ` · Top ${c.top}%` : ""}{c.mentor ? " · Clinical Fellow Mentor" : ""}
      </p>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <div className="text-[44px] leading-none font-bold tabular">{c.rating}</div>
        <div className="mt-1 text-[13.5px] text-fg-2">Clinical Rating across {c.ratedCases} unassisted simulated cases</div>
        <div className="mt-4">
          {row("Diagnostic Precision", c.indices.diagnosticPrecision)}
          {row("Patient Safety & Zero-Harm Index", c.indices.zeroHarm)}
          {row("Emergency Stabilization Speed", c.indices.stabilisationSpeed)}
          {row("Investigation Stewardship", c.indices.stewardship)}
        </div>
      </div>
      {c.mastery.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[15px] font-semibold">Specialties</h2>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {c.mastery.map((m) => (
              <li key={m.specialty} className="flex justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[13.5px]">
                <span>{m.specialty}</span>
                <span className="text-fg-2 tabular">{m.percent}% · {m.cases} {m.cases === 1 ? "case" : "cases"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-8 text-[12.5px] leading-5 text-fg-3">
        Verified by RamAI as of {new Date(c.asOf).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}: these scores come from RamAI&apos;s own records of simulated cases. It is a self-assessment tool, not a medical qualification, licence, CME credit or employment reference. RamAI does not verify the doctor&apos;s identity or registration; the name is as they entered it.
      </p>
    </main>
  );
}
