import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { ExamPractice } from "@/components/exams/exam-practice";
import { PublicPage } from "@/components/shell/public-page";
import { EXAMS, isExamId } from "@/lib/exams";
import { countryFromIp } from "@/lib/plans";
import { getCurrentUser } from "@/server/auth";
import { examStats } from "@/server/exam-practice";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ exam: string }> }): Promise<Metadata> {
  const { exam } = await params;
  return { title: isExamId(exam) ? `${EXAMS[exam].label} practice` : "Exam practice" };
}

/** One exam's practice — only the exams of the country the doctor practises in. */
export default async function ExamPage({ params }: { params: Promise<{ exam: string }> }) {
  const { exam } = await params;
  if (!isExamId(exam)) notFound();
  const user = await getCurrentUser().catch(() => null);
  const country = user?.country ?? countryFromIp((await headers()).get("x-vercel-ip-country"));
  if (EXAMS[exam].country !== country) redirect("/exams");
  const stats = user ? await examStats(user.id, exam) : null;
  return (
    <PublicPage>
      <div className="mx-auto w-full max-w-3xl">
        <ExamPractice exam={exam} stats={stats} />
      </div>
    </PublicPage>
  );
}
