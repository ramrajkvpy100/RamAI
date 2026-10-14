import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { AppShell } from "@/components/app/app-shell";
import { checkOpenAI } from "@/lib/server/openai-check";
import { usageReport, type UsageRow } from "@/server/ai-usage";
import { donationSummary } from "@/server/donations";
import { getMe } from "@/server/me";

export const metadata: Metadata = { title: "AI costs · Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  "case-start": "Inventing patients",
  "case-teaching": "Teaching notes (background)",
  turn: "Case turns",
  picture: "Case pictures",
  coach: "Coach feedback",
  learn: "Pearls and case MCQs",
  disease: "Understand the disease",
  exams: "Exam MCQ sets",
  practice: "Practice image checks",
  moderation: "Community moderation",
  report: "Progress reports",
  other: "Other",
};

/** Pro's price (₹299 a month), less Razorpay's fee of about 2% plus 18% GST on it. */
const PRO_NET_INR = 299 * (1 - 0.0236);

const tokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));

/** Admins only: what the AI really costs, per kind of work and per case — the numbers to price Pro on. */
export default async function AdminCosts() {
  const me = await getMe();
  if (!me) redirect("/login?next=/admin/costs");
  if (!me.admin) notFound();
  const [r, gifts] = await Promise.all([usageReport(30), donationSummary().catch(() => null)]);
  const rate = Number(process.env.RAMAI_USD_INR) || 88;
  const inr = (usd: number | null) => (usd === null ? "—" : `₹${(usd * rate).toFixed(usd * rate < 1 ? 2 : 1)}`);
  const row = (k: UsageRow, label: string, strong = false) => (
    <tr key={k.kind} className={strong ? "font-semibold" : undefined}>
      <td className="py-1.5 pr-3">{label}</td>
      <td className="py-1.5 pr-3 text-right tabular">{k.calls}</td>
      <td className="py-1.5 pr-3 text-right tabular">{tokens(k.inputTokens)}</td>
      <td className="py-1.5 pr-3 text-right tabular">{k.inputTokens ? `${Math.round((100 * k.cachedTokens) / k.inputTokens)}%` : "—"}</td>
      <td className="py-1.5 pr-3 text-right tabular">{tokens(k.outputTokens)}</td>
      <td className="py-1.5 pr-3 text-right tabular">{k.images}</td>
      <td className="py-1.5 text-right tabular">{inr(k.usd)}</td>
    </tr>
  );
  const breakEven = r.perCase ? Math.floor(PRO_NET_INR / (r.perCase * rate)) : null;
  return (
    <AppShell me={me} wide>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-[24px] font-bold tracking-[-0.01em]">AI costs</h1>
        <Suspense fallback={<p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-[13.5px] text-fg-2">Checking the OpenAI connection…</p>}>
          <AiStatus />
        </Suspense>
        <p className="mt-4 text-[14px] text-fg-2">The last {r.days} days, from the usage OpenAI reports with every call. Rupees at ₹{rate} to the dollar.</p>
        {!r.prices && (
          <p className="mt-4 rounded-xl bg-warning-soft px-4 py-3 text-[13.5px] text-warning">
            Costs show once your OpenAI prices are set in Vercel (USD, from OpenAI&apos;s pricing page): RAMAI_PRICE_INPUT_PER_M, RAMAI_PRICE_CACHED_PER_M, RAMAI_PRICE_OUTPUT_PER_M (per million tokens) and RAMAI_PRICE_IMAGE (per picture). Tokens are counted either way.
          </p>
        )}
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            ["Cases started", String(r.cases)],
            ["Average cost per case", inr(r.perCase)],
            ["Typical case (median)", inr(r.caseCost.median)],
            ["Dearest 10% of cases", inr(r.caseCost.p90)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-surface-2 px-4 py-3">
              <div className="text-[12px] text-fg-2">{label}</div>
              <div className="mt-1 text-[20px] font-bold tabular">{value}</div>
            </div>
          ))}
        </div>
        {breakEven !== null && (
          <p className="mt-4 text-[14px] text-fg-2">
            At the average cost, one Pro month (₹299, about ₹{Math.round(PRO_NET_INR)} after Razorpay&apos;s fee) pays for <strong className="text-fg">{breakEven} cases</strong>.
          </p>
        )}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[620px] text-[13.5px]">
            <thead className="text-left text-[12px] text-fg-2">
              <tr>
                <th className="pb-2 font-medium">Work</th>
                <th className="pb-2 text-right font-medium">Calls</th>
                <th className="pb-2 text-right font-medium">Input</th>
                <th className="pb-2 text-right font-medium">Cached</th>
                <th className="pb-2 text-right font-medium">Output</th>
                <th className="pb-2 text-right font-medium">Pictures drawn</th>
                <th className="pb-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              {r.kinds.map((k) => row(k, KIND_LABEL[k.kind] ?? k.kind))}
              {row(r.total, "All AI", true)}
            </tbody>
          </table>
        </div>
        {gifts && (
          <section className="mt-10" aria-labelledby="gifts-heading">
            <h2 id="gifts-heading" className="text-[18px] font-bold">
              Donations
            </h2>
            <p className="mt-1 text-[14px] text-fg-2">
              {gifts.count} paid {gifts.count === 1 ? "gift" : "gifts"} · <strong className="text-fg">₹{gifts.total.toLocaleString("en-IN")}</strong> in all (live payments; Razorpay&apos;s fee comes off this).
            </p>
            {gifts.recent.length > 0 && (
              <ul className="mt-3 divide-y divide-line-2 text-[13.5px]">
                {gifts.recent.map((g, i) => (
                  <li key={i} className="flex gap-3 py-2">
                    <span className="w-16 shrink-0 font-semibold tabular">₹{g.rupees.toLocaleString("en-IN")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{g.name ?? "Anonymous"}</span>
                      {g.mode === "test" && <span className="ml-2 rounded bg-warning-soft px-1.5 text-[11px] font-semibold text-warning">TEST</span>}
                      {g.message && <span className="block text-fg-2">{g.message}</span>}
                    </span>
                    <span className="shrink-0 text-[12.5px] text-fg-3">{new Date(g.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <p className="mt-4 text-[12.5px] text-fg-3">Case cost percentiles cover the {r.caseCost.counted} cases whose calls were counted against them. Pictures found on Wikimedia Commons cost only the model&apos;s check.</p>
      </div>
    </AppShell>
  );
}

/** Whether the live site's AI works right now — and, when it doesn't, exactly why (no credit, wrong key, model). */
async function AiStatus() {
  const { OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL } = process.env;
  const c = await checkOpenAI({ OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL }).catch(() => ({ ok: false, model: OPENAI_MODEL ?? "", problem: "The check itself failed. Try reloading." }));
  return c.ok ? (
    <p className="mt-4 rounded-xl bg-success-soft px-4 py-3 text-[13.5px] text-success">
      AI working — model {c.model}
      {"ms" in c && c.ms ? `, answered in ${(c.ms / 1000).toFixed(1)} s` : ""}.
    </p>
  ) : (
    <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] text-danger">
      <strong>AI not working</strong> (model {c.model}): {c.problem} Until this is fixed, new cases, exam sets and practice pictures can&apos;t be made.
    </p>
  );
}
