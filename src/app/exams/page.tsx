import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { PublicPage } from "@/components/shell/public-page";
import { Icon } from "@/components/ui/icon";
import { examsFor } from "@/lib/exams";
import { countryFromIp } from "@/lib/plans";
import { getCurrentUser } from "@/server/auth";
import { examStats } from "@/server/exam-practice";

export const metadata: Metadata = { title: "Exam practice", description: "NEET PG and INI-CET, USMLE, UKMLA and PLAB practice questions — single best answer, with explanations." };
export const dynamic = "force-dynamic";

const BLURB: Record<string, string> = {
  "neet-pg": "All 19 subjects, NBE style — drug of choice, investigation of choice, next best step.",
  "ini-cet": "AIIMS style — conceptual, two-step reasoning and recent advances.",
  usmle: "Step 1 sciences and Step 2 CK clinical vignettes with five options.",
  ukmla: "The MLA content map — Applied Knowledge Test style, NICE and BNF.",
  plab: "PLAB 1 vignettes set in NHS practice — NICE, CKS, BNF and GMC guidance.",
};

/** The exams of the country the doctor practises in — India: NEET PG and INI-CET; the USA: USMLE; the UK: UKMLA and PLAB. */
export default async function ExamsPage() {
  const user = await getCurrentUser().catch(() => null);
  const country = user?.country ?? countryFromIp((await headers()).get("x-vercel-ip-country"));
  const exams = examsFor(country);
  const stats = user ? await Promise.all(exams.map((e) => examStats(user.id, e.id))) : [];
  return (
    <PublicPage>
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.025em] sm:text-[38px]">Exam practice</h1>
        <p className="mt-2 text-[15px] leading-7 text-fg-2">Single-best-answer questions in your exam&apos;s own style, each checked by an AI examiner, with an explanation after every answer. Practice here is separate from your cases, XP and rank.</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {exams.map((e, i) => {
            const st = stats[i];
            return (
              <Link key={e.id} href={`/exams/${e.id}`} className="panel group flex flex-col gap-2 p-5 transition-transform hover:-translate-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[19px] font-semibold">{e.label}</span>
                  <Icon name="arrow-right" size={16} className="text-fg-3 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[13.5px] leading-6 text-fg-2">{BLURB[e.id]}</p>
                <p className="mt-1 text-[12.5px] text-fg-3 tabular">{st && st.answered ? `${st.correct} of ${st.answered} right · ${Math.round((st.correct / st.answered) * 100)}%` : `${e.subjects.length} subjects`}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </PublicPage>
  );
}
