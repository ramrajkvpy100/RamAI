import type { Metadata } from "next";
import Link from "next/link";

import { PublicPage } from "@/components/shell/public-page";
import { learnEntries } from "@/lib/learn";
import { MODALITIES, MODALITY_IDS } from "@/lib/practice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learn — ECG, X-ray, CT, ultrasound, blood smear and clinical signs",
  description: "Key features of hundreds of diagnoses: ECG rhythms, chest and bone X-rays, CT, ultrasound, peripheral smears and clinical photographs — then practise spotting them free.",
  alternates: { canonical: "/learn" },
};

export default function LearnIndex() {
  const all = learnEntries();
  return (
    <PublicPage>
      <div className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-[34px] font-semibold tracking-[-0.02em]">Learn to spot the diagnosis</h1>
        <p className="mt-2 text-[15px] text-fg-2">The one thing to recognise each diagnosis by — on ECG, X-ray, CT, ultrasound, blood smear and at the bedside.</p>
        {MODALITY_IDS.map((m) => {
          const list = all.filter((e) => e.modality === m);
          const groups = [...new Set(list.map((e) => e.group))];
          return (
            <section key={m} className="mt-8">
              <h2 className="text-[20px] font-semibold">{MODALITIES[m].label}</h2>
              {groups.map((g) => (
                <div key={g} className="mt-3">
                  <h3 className="text-[13px] font-semibold text-fg-3">{g}</h3>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {list.filter((e) => e.group === g).map((e) => <li key={e.slug}><Link href={`/learn/${e.slug}`} className="inline-block rounded-full border border-line px-3 py-1 text-[13px] hover:bg-surface-2">{e.item.label}</Link></li>)}
                  </ul>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </PublicPage>
  );
}
