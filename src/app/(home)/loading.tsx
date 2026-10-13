import { Wordmark } from "@/components/brand/wordmark";

/**
 * Shown the instant the home page is asked for, while its data loads: the bar
 * and the shape of the page, so it's never blank. Only here — pages that send
 * people elsewhere (sign-in, not found) must decide before anything is shown.
 */
export default function Loading() {
  return (
    <div className="relative flex min-h-dvh flex-col" aria-busy="true" aria-label="Loading">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_15%_0%,var(--mesh-1),transparent_70%),radial-gradient(50%_50%_at_90%_10%,var(--mesh-3),transparent_70%)]" />
      <header className="material-bar sticky top-0 z-40 border-b border-[var(--material-stroke)]">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
          <Wordmark />
          <span className="ml-auto h-8 w-8 animate-pulse rounded-full bg-surface-3" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-8">
        <div className="h-[220px] animate-pulse rounded-[22px] bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-40 animate-pulse rounded-[22px] bg-[color-mix(in_srgb,var(--fg)_5%,transparent)]" />
          <div className="h-40 animate-pulse rounded-[22px] bg-[color-mix(in_srgb,var(--fg)_5%,transparent)]" />
        </div>
      </main>
    </div>
  );
}
