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
  const lines = text
    .split(/\n+/)
    .flatMap((l) => (l.length > 160 && !/^\s*[•\-–]/.test(l) ? l.split(/(?<=[.;])\s+(?=[A-Z])/) : [l]))
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {lines.map((l, i) => (
        <p key={i} className="leading-6">
          {line(l)}
        </p>
      ))}
    </div>
  );
}
