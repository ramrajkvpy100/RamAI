import { Wordmark } from "@/components/brand/wordmark";
import { WaitingFact } from "@/components/ui/waiting-fact";

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
          <span className="ml-auto h-8 w-8 skeleton rounded-full" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pt-6 pb-8 sm:px-6 sm:pt-8">
        <div className="h-9 w-56 skeleton rounded-xl" />
        <svg viewBox="0 0 300 40" className="h-8 w-full max-w-sm text-accent-text" aria-hidden>
          <path className="pulse-line" d="M0 22H95l8-6 8 6h12l6 4 8-24 8 30 6-10h16l10-6 12 6H300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <WaitingFact className="max-w-xl" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 skeleton rounded-[22px]" />
        ))}
      </main>
    </div>
  );
}
