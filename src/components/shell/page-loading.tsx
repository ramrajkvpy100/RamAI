import { Wordmark } from "@/components/brand/wordmark";

/**
 * The instant outline of an app page while its data loads (Skills Lab, exams, leaderboard, community):
 * a tap shows the page at once instead of waiting on the server with nothing on screen.
 */
export function PageLoading() {
  return (
    <div className="relative flex min-h-dvh flex-col" aria-busy="true" aria-label="Loading">
      <header className="material-bar sticky top-0 z-40 border-b border-[var(--material-stroke)]">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
          <Wordmark />
          <span className="ml-auto h-8 w-8 animate-pulse rounded-full bg-surface-3" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pt-6 pb-8 sm:px-6 sm:pt-8">
        <div className="h-9 w-56 animate-pulse rounded-xl bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-[22px] bg-[color-mix(in_srgb,var(--fg)_5%,transparent)]" />
        ))}
      </main>
    </div>
  );
}
