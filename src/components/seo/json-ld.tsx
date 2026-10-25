import { FAQ } from "@/lib/faq";
import { SITE } from "@/lib/site";

const PLAY = "https://play.google.com/store/apps/details?id=com.ramai.app";

/** Structured data for search engines and answer engines: who we are, the app, and (optionally) the FAQ. */
export function JsonLd({ faq = false }: { faq?: boolean }) {
  const graph: Record<string, unknown>[] = [
    { "@type": "Organization", "@id": `${SITE.url}/#org`, name: "RamAI", url: SITE.url, logo: `${SITE.url}/icon-512.png`, email: SITE.email, founder: SITE.owner ? { "@type": "Person", name: SITE.owner } : undefined, sameAs: [PLAY] },
    { "@type": "WebSite", "@id": `${SITE.url}/#site`, name: "RamAI", url: SITE.url, publisher: { "@id": `${SITE.url}/#org` }, inLanguage: "en" },
    {
      "@type": ["SoftwareApplication", "MobileApplication"],
      name: "RamAI: Clinical Case Simulator",
      operatingSystem: "Android, Web",
      applicationCategory: "EducationalApplication",
      url: SITE.url,
      installUrl: PLAY,
      description: "Clinical case simulator for doctors and medical students: virtual patients, history, examination, investigations, diagnosis and treatment, with a scored debrief. Skills Lab (ECG, X-ray, CT, ultrasound, clinical images, heart sounds) and NEET PG / USMLE / PLAB-style MCQs.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      audience: { "@type": "Audience", audienceType: "Medical students and doctors" },
      publisher: { "@id": `${SITE.url}/#org` },
    },
  ];
  if (faq) graph.push({ "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c") }} />;
}
