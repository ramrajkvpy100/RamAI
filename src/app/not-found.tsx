import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Wordmark size="md" />
      <div>
        <div className="micro text-fg-2">404</div>
        <p className="mt-2 text-[15px] text-fg-2">This page doesn't exist.</p>
      </div>
      <Link href="/" className="text-ui text-accent-text hover:underline">
        Back to RamAI
      </Link>
    </main>
  );
}
