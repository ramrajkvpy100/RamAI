import Link from "next/link";
import type { ReactNode } from "react";

import { SITE } from "@/lib/site";

/** A readable page for policies and company information. */
export function LegalPage({ eyebrow, title, intro, updated = true, children }: { eyebrow: string; title: string; intro?: ReactNode; updated?: boolean; children: ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-3xl animate-enter">
      <div className="micro text-accent-text">{eyebrow}</div>
      <h1 className="mt-2 text-[32px] leading-tight font-semibold tracking-[-0.03em] sm:text-[38px]">{title}</h1>
      {intro && <p className="mt-4 text-[16.5px] leading-8 text-fg-2">{intro}</p>}
      {updated && <p className="mt-3 text-[12.5px] text-fg-3">Last updated {SITE.updated}</p>}
      <div className="mt-8 border-t border-line pb-6">{children}</div>
    </article>
  );
}

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 pt-9">
      <h2 className="text-[19px] font-semibold tracking-[-0.01em]">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-[15px] leading-7 text-fg-2">{children}</div>
    </section>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-fg-3">{children}</ul>;
}

/** A link inside policy text. */
export function A({ href, children }: { href: string; children: ReactNode }) {
  const external = /^(https?:|mailto:|tel:)/.test(href);
  return external ? (
    <a href={href} className="font-medium text-accent-text underline-offset-2 hover:underline" {...(href.startsWith("http") && { target: "_blank", rel: "noopener noreferrer" })}>
      {children}
    </a>
  ) : (
    <Link href={href} className="font-medium text-accent-text underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}

/** The support email as a link. */
export const Email = () => <A href={`mailto:${SITE.email}`}>{SITE.email}</A>;
