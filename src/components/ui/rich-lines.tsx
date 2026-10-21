import { Fragment, type ReactNode } from "react";

/** "**bold**" in a line becomes bold; a short "Label:" at the start of a line is bold too. */
function line(text: string): ReactNode {
  const label = text.match(/^((?:[•\-–]\s*)?[A-Z][^:]{1,28}:)\s/);
  const rest = label ? text.slice(label[1]!.length) : text;
  const parts = rest.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={i} className="font-semibold text-fg">{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>));
  return (
    <>
      {label && <b className="font-semibold text-fg">{label[1]}</b>}
      {parts}
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
