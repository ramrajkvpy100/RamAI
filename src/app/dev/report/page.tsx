"use client";

import { ReportProblem } from "@/components/case/report-problem";
import { EcgTrace } from "@/components/media/ecg";
import { MODALITIES } from "@/lib/practice";

/** Development only: the report button, on a page with an X-ray, a drawn ECG and text to photograph. */
export default function ReportPreview() {
  if (process.env.NODE_ENV === "production") return null;
  const ecg = MODALITIES.ecg.items.find((i) => i.id === "af")!.ecg!;
  return (
    <div className="flex flex-col gap-4 p-6">
      <div id="chat" className="h-48 overflow-y-auto rounded-xl border border-line">
        <div className="flex flex-col gap-2 p-3">
          {Array.from({ length: 40 }, (_, i) => (
            <div key={i} className="rounded-lg bg-surface-2 px-3 py-1.5 text-[14px]">Message {i + 1}</div>
          ))}
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/radiology/singles/pneumoperitoneum/1.jpg" alt="X-ray" className="w-64 rounded-xl" />
      <div className="w-[520px] max-w-full rounded-xl bg-white"><EcgTrace spec={ecg} /></div>
      <ReportProblem />
    </div>
  );
}
