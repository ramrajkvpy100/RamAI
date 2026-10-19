"use client";

import { ReportProblem } from "@/components/case/report-problem";

/** Development only: the report button, on a page with something to photograph. */
export default function ReportPreview() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="p-6">
      <div className="panel mb-4 p-5 text-[15px]">Patient: I&apos;ve had fever for three days. 🤒</div>
      <ReportProblem />
    </div>
  );
}
