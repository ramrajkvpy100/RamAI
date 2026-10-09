import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { LEGAL_LINKS } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pt-6 pb-10 sm:px-6">
      <div className="flex flex-col gap-4 border-t border-line pt-6 text-[12.5px] text-fg-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Wordmark tile={false} className="text-fg-2" />
            <span>Clinical simulation for education. Cases are fictional — not medical advice.</span>
          </div>
          <Link href="/pricing" className="hover:text-fg">
            Pricing
          </Link>
        </div>
        <nav aria-label="Company and policies" className="flex flex-wrap gap-x-5 gap-y-2">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-fg">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
