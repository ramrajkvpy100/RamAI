import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { getMe } from "@/server/me";
import { isAdmin } from "@/server/suggestions";

export const metadata: Metadata = { title: "Case reports · Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const CATEGORY: Record<string, string> = { fact: "Wrong medical fact", result: "Wrong result, answer or picture", understanding: "Didn't understand me", broken: "Something broke", other: "Other" };

interface Row {
  id: string;
  reason: string;
  category: string | null;
  case_number: number | null;
  case_ref: string | null;
  screenshot: string | null;
  transcript: string | null;
  created_at: number;
  name: string | null;
  email: string | null;
}

/** Problems doctors reported while playing — newest first, each with its screenshot and the conversation. */
export default async function ReportsPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/admin/reports");
  const user = await getCurrentUser();
  if (!user || !(await isAdmin(user))) notFound();
  const rows = await db.all<Row>(
    "SELECT f.id, f.reason, f.category, f.case_number, f.case_ref, f.screenshot, f.transcript, f.created_at, u.name, u.email FROM case_feedback f LEFT JOIN users u ON u.id = f.user_id WHERE f.kind = 'report' ORDER BY f.created_at DESC LIMIT 100",
  );
  return (
    <AppShell me={me}>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Case reports</h1>
      <p className="mt-1 text-[14px] text-fg-2">{rows.length ? `${rows.length} most recent` : "No reports yet."}</p>
      <div className="mt-5 flex flex-col gap-4">
        {rows.map((r) => (
          <article key={r.id} id={r.id} className="panel flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="rounded-full bg-danger-soft px-2.5 py-0.5 font-semibold text-danger">{r.category ? CATEGORY[r.category] ?? r.category : "Report"}</span>
              {r.case_number !== null ? <span className="font-semibold">Case #{r.case_number}</span> : r.case_ref?.match(/^(skills|exam): /) ? <span className="font-semibold">{r.case_ref.replace(/^skills: /, "Skills Lab · ").replace(/^exam: /, "Exam · ")}</span> : null}
              <span className="text-fg-2">{r.name ?? "Someone"}{r.email ? ` · ${r.email}` : ""}</span>
              <span className="ml-auto text-fg-3">{new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</span>
            </div>
            {r.reason && <p className="text-[15px] leading-6">{r.reason}</p>}
            {r.screenshot && (
              <a href={r.screenshot} target="_blank" rel="noopener noreferrer" className="block max-w-sm overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.screenshot} alt="What the doctor saw" className="w-full" />
              </a>
            )}
            {r.transcript && (
              <details className="rounded-xl bg-surface-2 p-3 text-[13px]">
                <summary className="cursor-pointer font-medium">{r.case_number !== null ? "The conversation" : "The question"}</summary>
                <pre className="mt-2 font-sans whitespace-pre-wrap text-fg-2">{r.transcript}</pre>
              </details>
            )}
          </article>
        ))}
      </div>
    </AppShell>
  );
}
