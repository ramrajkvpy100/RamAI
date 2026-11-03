"use client";

import { useEffect, useState, type ComponentProps } from "react";

import { ClientShell } from "@/components/app/client-shell";
import { ProgressView } from "@/components/progress/progress-view";

export function ProgressShell() {
  return (
    <ClientShell wide signedOut="/">
      <ProgressNow />
    </ClientShell>
  );
}

function ProgressNow() {
  const [data, setData] = useState<Pick<ComponentProps<typeof ProgressView>, "detail" | "report"> | null>(null);
  useEffect(() => {
    fetch("/api/progress/detail", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => undefined);
  }, []);
  if (!data) return <div className="flex flex-col gap-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-32 rounded-[22px]" />)}</div>;
  return <ProgressView detail={data.detail} report={data.report} />;
}
