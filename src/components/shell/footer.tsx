import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pt-6 pb-10 sm:px-6">
      <div className="flex flex-col gap-4 border-t border-line pt-6 text-[12.5px] text-fg-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Wordmark tile={false} className="text-fg-2" />
          <span>Clinical simulation for educational purposes.</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Cases are fictional.</span>
          <Link href="/pricing" className="hover:text-fg">
            Pricing
          </Link>
        </div>
      </div>
    </footer>
  );
}
