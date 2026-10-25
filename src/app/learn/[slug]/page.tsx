import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicPage } from "@/components/shell/public-page";
import { RichLines } from "@/components/ui/rich-lines";
import { learnEntries, learnEntry, plain } from "@/lib/learn";
import { MODALITIES } from "@/lib/practice";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = learnEntry((await params).slug);
  if (!e) return {};
  const kind = MODALITIES[e.modality].label;
  return {
    title: `${e.item.label} — ${kind} key features`,
    description: `How to recognise ${e.item.label} on ${kind.toLowerCase() === "clinical images" ? "examination" : kind}: ${plain(e.item.key)}`.slice(0, 158),
    alternates: { canonical: `/learn/${e.slug}` },
  };
}

export default async function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const e = learnEntry((await params).slug);
  if (!e) notFound();
  const m = MODALITIES[e.modality];
  const related = learnEntries().filter((x) => x.modality === e.modality && x.group === e.group && x.slug !== e.slug).slice(0, 8);
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "MedicalWebPage", name: `${e.item.label} — ${m.label} key features`, url: `${SITE.url}/learn/${e.slug}`, about: { "@type": "MedicalCondition", name: e.item.label }, audience: { "@type": "MedicalAudience", audienceType: "Clinician" }, publisher: { "@type": "Organization", name: "RamAI", url: SITE.url } },
      { "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: `How do you recognise ${e.item.label} on ${m.label.toLowerCase()}?`, acceptedAnswer: { "@type": "Answer", text: plain(e.item.key) } }] },
    ],
  };
  return (
    <PublicPage>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <article className="mx-auto flex max-w-2xl flex-col gap-5 px-5 py-10">
        <nav className="text-[13px] text-fg-3"><Link href="/learn" className="hover:underline">Learn</Link> · {m.label} · {e.group}</nav>
        <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.02em]">{e.item.label}</h1>
        <section className="card p-5">
          <h2 className="text-[13px] font-semibold tracking-[0.1em] text-fg-3 uppercase">How to recognise it on {m.label === "Clinical images" ? "examination" : m.label}</h2>
          <RichLines text={e.item.key} className="mt-2 text-[16px]" />
        </section>
        <Link href={`/practice?drill=spot`} className="flex items-center justify-between rounded-2xl bg-accent px-5 py-4 text-on-accent">
          <span><span className="block text-[16px] font-semibold">Practise spotting it</span><span className="block text-[13px] opacity-85">Real {m.label.toLowerCase()} pictures in RamAI&apos;s Skills Lab — free</span></span>
          <span aria-hidden>→</span>
        </Link>
        {related.length > 0 && (
          <section>
            <h2 className="text-[15px] font-semibold">More in {e.group}</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {related.map((r) => <li key={r.slug}><Link href={`/learn/${r.slug}`} className="inline-block rounded-full border border-line px-3 py-1.5 text-[13px] hover:bg-surface-2">{r.item.label}</Link></li>)}
            </ul>
          </section>
        )}
        <p className="text-[12px] text-fg-3">For education only — not medical advice.</p>
      </article>
    </PublicPage>
  );
}
