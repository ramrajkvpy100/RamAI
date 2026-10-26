import { Fragment, type ReactNode } from "react";

/** Bold as written by AI: **x**, __x__ or *x* (a stray asterisk is dropped). */
const BOLD = /(\*\*[^*]+?\*\*|__[^_]+?__|(?<![\w*])\*[^*\s][^*]*?\*(?![\w*]))/g;
function bolded(text: string): ReactNode[] {
  return text.split(BOLD).map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/) ?? p.match(/^__([^_]+)__$/) ?? p.match(/^\*([^*]+)\*$/);
    return m ? <b key={i} className="font-bold text-fg">{m[1]}</b> : <Fragment key={i}>{p.replace(/\*\*?/g, "")}</Fragment>;
  });
}

/** "**bold**" in a line becomes bold; a short "Label:" at the start of a line is bold too. */
function line(text: string): ReactNode {
  const label = text.match(/^((?:[•\-–]\s*)?[A-Z][^:,.*]{1,28}:)\s/);
  const rest = label ? text.slice(label[1]!.length) : text;
  const parts = bolded(rest);
  return (
    <>
      {label && <b className="font-semibold text-fg">{label[1]}</b>}
      {parts}
    </>
  );
}

/** Inline text with "**bold**" shown as bold (and stray asterisks dropped) — for one-line items. */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {bolded(text)}
    </>
  );
}

/**
 * Teaching text as short, scannable lines — never a wall of prose: each line on its own, a long sentence split at
 * its full stops, and the key words in bold.
 */
export function RichLines({ text, className = "" }: { text: string; className?: string }) {
  // A markdown table ("| Feature | A | B |" rows) becomes a real table; the rest stays short lines.
  const blocks: ({ kind: "line"; text: string } | { kind: "table"; rows: string[][] })[] = [];
  for (const raw of text.split(/\n+/)) {
    const l = raw.trim();
    if (!l) continue;
    if (/^\|.*\|$/.test(l)) {
      if (/^\|[\s:|-]+\|$/.test(l)) continue; // the |---|---| divider
      const cells = l.slice(1, -1).split("|").map((c) => c.trim());
      const last = blocks[blocks.length - 1];
      if (last?.kind === "table") last.rows.push(cells);
      else blocks.push({ kind: "table", rows: [cells] });
      continue;
    }
    for (const part of l.length > 160 && !/^\s*[•\-–]/.test(l) ? l.split(/(?<=[.;])\s+(?=[A-Z])/) : [l]) if (part.trim()) blocks.push({ kind: "line", text: part.trim() });
  }
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {blocks.map((b, i) =>
        b.kind === "line" ? (
          <p key={i} className="leading-6">
            {line(b.text)}
          </p>
        ) : (
          <div key={i} className="my-1.5 overflow-x-auto rounded-xl border border-line">
            <table className="w-full border-collapse text-left text-[13.5px] leading-5">
              <thead className="bg-surface-3">
                <tr>{b.rows[0]!.map((c, j) => <th key={j} className="border-b border-line px-3 py-2 font-semibold">{bolded(c)}</th>)}</tr>
              </thead>
              <tbody>
                {b.rows.slice(1).map((r, k) => (
                  <tr key={k} className="even:bg-surface-2">
                    {r.map((c, j) => <td key={j} className={`border-t border-line px-3 py-2 align-top ${j === 0 ? "font-medium" : ""}`}>{bolded(c)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}
    </div>
  );
}
