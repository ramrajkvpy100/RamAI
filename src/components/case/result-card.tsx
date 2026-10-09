"use client";

import { MediaFigure } from "@/components/media/media-figure";
import { Icon } from "@/components/ui/icon";
import type { Flag, InvestigationResult } from "@/engine/types";
import { cn } from "@/lib/cn";
import type { Country } from "@/engine/countries";
import { clockAt, money } from "@/lib/format";

const FLAG_CLASS: Record<Flag, string> = {
  normal: "text-fg",
  unknown: "text-fg",
  low: "text-warning",
  high: "text-warning",
  critical: "text-danger font-semibold",
};

function FlagGlyph({ flag }: { flag: Flag }) {
  if (flag === "high") return <span aria-label="above range" className="ml-1 text-[10px]">▲</span>;
  if (flag === "low") return <span aria-label="below range" className="ml-1 text-[10px]">▼</span>;
  if (flag === "critical") return <span aria-label="critical" className="ml-1 text-[10px]">◆</span>;
  return null;
}

export function ResultCard({
  inv,
  arrivalMinuteOfDay,
  now,
  country,
  className,
  highlight = false,
}: {
  inv: InvestigationResult;
  arrivalMinuteOfDay: number;
  now: number;
  /** Costs are already in this country's money. */
  country?: Country;
  className?: string;
  highlight?: boolean;
}) {
  const pending = inv.status === "pending";
  const remaining = Math.max(1, Math.round(inv.resultAt - now));
  return (
    <article
      className={cn("card overflow-hidden", highlight && "animate-rise", className)}
      aria-label={`${inv.name} ${pending ? "pending" : "result"}`}
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-3 pb-2.5">
        <div className="min-w-0">
          <h3 className="text-[14px] font-medium tracking-[-0.005em]">{inv.name}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[11.5px] text-fg-2 tabular">
          {pending ? (
            <>
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-breathe rounded-full bg-accent" />
              </span>
              Awaiting · ~{remaining >= 120 ? `${Math.round(remaining / 60)} h` : `${remaining} min`}
            </>
          ) : (
            <>
              <Icon name="check" size={12} className="text-success" />
              {clockAt(arrivalMinuteOfDay, inv.resultAt)}
            </>
          )}
        </div>
      </header>

      {pending ? (
        <div className="space-y-2 px-4 pb-4" aria-hidden>
          {[0.82, 0.64, 0.74].map((w, i) => (
            <div key={i} className="relative h-2.5 overflow-hidden rounded bg-surface-3" style={{ width: `${w * 100}%` }}>
              <div className="absolute inset-y-0 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--fg)_6%,transparent)] to-transparent" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {inv.rows && inv.rows.length > 0 && (
            <table className="w-full border-t border-line-2 text-ui">
              <caption className="sr-only">{inv.name} results</caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">Analyte</th>
                  <th scope="col">Value</th>
                  <th scope="col">Reference</th>
                </tr>
              </thead>
              <tbody>
                {inv.rows.map((row) => (
                  <tr key={row.analyte} className={cn("border-b border-line-2 last:border-b-0", row.flag !== "normal" && row.flag !== "unknown" && "bg-[color-mix(in_srgb,var(--warning)_4%,transparent)]")}>
                    <th scope="row" className="py-2 pr-2 pl-4 text-left font-normal text-fg-2">
                      {row.analyte}
                    </th>
                    <td className={cn("py-2 pr-2 text-right whitespace-nowrap tabular", FLAG_CLASS[row.flag])}>
                      {row.value}
                      {row.unit && <span className="ml-1 text-[11px] font-normal text-fg-3">{row.unit}</span>}
                      <FlagGlyph flag={row.flag} />
                    </td>
                    <td className="w-[34%] py-2 pr-4 text-right text-[11.5px] whitespace-nowrap text-fg-3 tabular">{row.reference ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {inv.media && (
            <div className={cn("px-3 pb-3", inv.rows?.length ? "pt-3" : "")}>
              <MediaFigure media={inv.media} viewerKey={inv.id} title={inv.name} />
            </div>
          )}
          {inv.report && <p className={cn("px-4 pb-3.5 text-ui leading-relaxed text-fg-2", (inv.rows?.length || inv.media) && "pt-0.5")}>{inv.report}</p>}
        </>
      )}
      {typeof inv.cost === "number" && inv.cost > 0 && (
        <footer className="flex justify-end border-t border-line-2 px-4 py-1.5 text-[11px] text-fg-3 tabular">{money(inv.cost, country)}</footer>
      )}
    </article>
  );
}
