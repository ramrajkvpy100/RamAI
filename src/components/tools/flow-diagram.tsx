"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { layoutFlow } from "@/lib/tools/flow-layout";
import type { Flowchart, FlowNode } from "@/lib/tools/flowcharts";
import { cn } from "@/lib/cn";
import { tap } from "@/lib/haptics";

const GAP = 14;
const ROW_GAP = 40;
const SIDE = 34;

const SHAPE: Record<FlowNode["kind"], string> = {
  question: "bg-amber-200 text-[#3d2c00] px-4 py-3 [clip-path:polygon(9%_0,91%_0,100%_50%,91%_100%,9%_100%,0_50%)]",
  step: "bg-blue-600 text-white rounded-lg px-2.5 py-2",
  end: "bg-emerald-600 text-white rounded-[22px] px-3 py-2.5",
};

/** A real flowchart: decisions as pointed boxes, steps as rectangles, ends as pills, joined by arrows. Tap "Walk through" to go down it with Yes and No. */
export function FlowDiagram({ chart }: { chart: Flowchart }) {
  const layout = useMemo(() => layoutFlow(chart.nodes), [chart]);
  const byId = useMemo(() => new Map(chart.nodes.map((n) => [n.id, n])), [chart]);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [room, setRoom] = useState(320);
  const boxes = useRef(new Map<string, HTMLDivElement>());
  const scroller = useRef<HTMLDivElement>(null);
  const [walking, setWalking] = useState(false);
  const [path, setPath] = useState<string[]>([chart.nodes[0]!.id]);

  // Boxes shrink to fit the screen, down to what stays readable; a chart wider than that scrolls sideways.
  const hasLoop = layout.edges.some((e) => e.back);
  const BOX = Math.round(Math.max(108, Math.min(176, (room - (hasLoop ? SIDE : 0) - 8 - (layout.cols - 1) * GAP) / layout.cols)));
  const COL = BOX + GAP;
  useLayoutEffect(() => {
    const measure = () => setRoom(scroller.current?.clientWidth ?? 320);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Text sets each box's height; rows and arrows are placed from that.
  useLayoutEffect(() => {
    const next: Record<string, number> = {};
    for (const [id, el] of boxes.current) next[id] = el.offsetHeight;
    setHeights(next);
  }, [chart, BOX]);

  const rowH = Array.from({ length: layout.ranks }, (_, r) => Math.max(40, ...chart.nodes.filter((n) => layout.rank.get(n.id) === r).map((n) => heights[n.id] ?? 60)));
  const rowY: number[] = [];
  rowH.reduce((y, h, r) => ((rowY[r] = y), y + h + ROW_GAP), 4);
  const height = (rowY[layout.ranks - 1] ?? 0) + (rowH[layout.ranks - 1] ?? 0) + 8;
  const width = (layout.cols - 1) * COL + BOX + (hasLoop ? SIDE : 0) + 4;
  const cx = (col: number) => 2 + col * COL + BOX / 2;
  const top = (id: string) => rowY[layout.rank.get(id)!]! + (rowH[layout.rank.get(id)!]! - (heights[id] ?? 60)) / 2;
  const bottom = (id: string) => top(id) + (heights[id] ?? 60);

  const now = byId.get(path[path.length - 1]!)!;
  const seen = new Set(path);
  const passed = new Set(path.slice(1).map((id, i) => `${path[i]}>${id}`));

  // Keep the box you're on in view: it can be off to the side, or below the fold.
  useEffect(() => {
    if (!walking) return;
    boxes.current.get(now.id)?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  }, [walking, now.id]);
  // A wide chart opens with its first box in view.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = Math.max(0, cx(layout.col.get(chart.nodes[0]!.id) ?? 0) - el.clientWidth / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, layout, COL]);

  const go = (id?: string) => {
    if (!id) return;
    tap();
    setPath((p) => [...p, id]);
  };
  const restart = () => setPath([chart.nodes[0]!.id]);

  return (
    <div className="mt-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-medium text-fg-2">
        <span className="flex items-center gap-1"><i className="h-2.5 w-4 bg-amber-300 [clip-path:polygon(20%_0,80%_0,100%_50%,80%_100%,20%_100%,0_50%)]" />Decision</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-4 rounded-sm bg-blue-600" />Action</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-4 rounded-full bg-emerald-600" />End</span>
      </div>
      <div ref={scroller} className="-mx-3 overflow-x-auto rounded-xl bg-surface-2 py-1">
        <div className="relative mx-auto" style={{ width, height }}>
          <svg width={width} height={height} className="absolute inset-0" aria-hidden>
            <defs>
              <marker id={`${chart.id}-a`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 8 4 0 8Z" fill="var(--fg-2)" /></marker>
              <marker id={`${chart.id}-b`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 8 4 0 8Z" fill="#2563eb" /></marker>
            </defs>
            {layout.edges.map((e) => {
              const on = walking && passed.has(`${e.from}>${e.to}`);
              const stroke = on ? "#2563eb" : "var(--fg-3)";
              const marker = `url(#${chart.id}-${on ? "b" : "a"})`;
              const fromRow = layout.rank.get(e.from)!;
              const toCol = layout.col.get(e.to)!;
              const fromCol = layout.col.get(e.from)!;
              const out = e.side ? BOX / 3 : 0;
              const sx = cx(fromCol) + out;
              const sy = bottom(e.from);
              if (e.back) {
                // A loop: out of the side, up the margin, and back in.
                const lane = width - 8;
                const fy = top(e.from) + (heights[e.from] ?? 60) / 2;
                const ty = top(e.to) + (heights[e.to] ?? 60) / 2;
                return (
                  <g key={`${e.from}>${e.to}`}>
                    <path d={`M${cx(fromCol) + BOX / 2} ${fy}H${lane}V${ty}H${cx(toCol) + BOX / 2}`} fill="none" stroke={stroke} strokeWidth={on ? 2.4 : 1.5} strokeDasharray="4 3" markerEnd={marker} />
                    {e.label && <text x={cx(fromCol) + BOX / 2 + 3} y={fy - 4} fontSize="10.5" fontWeight="700" fill={e.label === "Yes" ? "#059669" : "#e11d48"}>{e.label}</text>}
                  </g>
                );
              }
              // Down, across at the middle of the gap, and down again; through a lane in each row it crosses.
              const pts: [number, number][] = [[sx, sy]];
              let lastX = sx;
              let lastY = sy;
              const step = (x: number, gapTop: number, gapBottom: number) => {
                const mid = (gapTop + gapBottom) / 2;
                if (Math.abs(x - lastX) > 1) pts.push([lastX, mid], [x, mid]);
                lastX = x;
                lastY = gapBottom;
              };
              let row = fromRow;
              for (const v of e.via) {
                step(cx(v.col), rowY[row]! + rowH[row]!, rowY[v.rank]!);
                pts.push([cx(v.col), rowY[v.rank]! + rowH[v.rank]!]);
                lastY = rowY[v.rank]! + rowH[v.rank]!;
                row = v.rank;
              }
              const tx = cx(toCol);
              step(tx, rowY[row]! + rowH[row]!, rowY[row + 1] ?? lastY);
              pts.push([tx, top(e.to) - 1]);
              return (
                <g key={`${e.from}>${e.to}`}>
                  <path d={`M${pts.map(([x, y]) => `${x} ${y}`).join("L")}`} fill="none" stroke={stroke} strokeWidth={on ? 2.4 : 1.5} strokeLinejoin="round" markerEnd={marker} />
                  {e.label && <text x={sx + (e.side ? 5 : -5)} y={sy + 13} textAnchor={e.side ? "start" : "end"} fontSize="10.5" fontWeight="700" fill={e.label === "Yes" ? "#059669" : "#e11d48"}>{e.label}</text>}
                </g>
              );
            })}
          </svg>
          {chart.nodes.map((n) => {
            const col = layout.col.get(n.id) ?? 0;
            const isNow = walking && now.id === n.id;
            return (
              <div
                key={n.id}
                ref={(el) => { if (el) boxes.current.set(n.id, el); else boxes.current.delete(n.id); }}
                className={cn("absolute text-center text-[12px] leading-[16px] font-semibold transition-opacity", SHAPE[n.kind], walking && !seen.has(n.id) && "opacity-35", isNow && "outline-2 outline-offset-2 outline-[#2563EB]")}
                style={{ left: cx(col) - BOX / 2, top: top(n.id), width: BOX }}
              >
                {n.text}
                {n.dose && <span className="mt-1 block rounded bg-white/90 px-1 py-0.5 text-[11px] leading-[14px] font-medium text-[#14233d]">{n.dose}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {!walking ? (
        <button type="button" onClick={() => { tap(); restart(); setWalking(true); }} className="btn-lip mt-3 min-h-11 w-full rounded-xl bg-accent text-[14.5px] font-extrabold text-on-accent">WALK THROUGH IT</button>
      ) : (
        <div className="mt-3">
          <p className="rounded-xl bg-surface-3 p-2.5 text-[14px] leading-5 font-semibold">{now.text}{now.dose && <span className="mt-1 block font-medium text-fg-2">💊 {now.dose}</span>}</p>
          {now.kind === "question" && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => go(now.yes)} className="btn-lip min-h-11 rounded-xl bg-emerald-600 text-[15px] font-extrabold text-white [--lip:#047857]">YES</button>
              <button type="button" onClick={() => go(now.no)} className="btn-lip min-h-11 rounded-xl bg-rose-600 text-[15px] font-extrabold text-white [--lip:#be123c]">NO</button>
            </div>
          )}
          {now.kind === "step" && <button type="button" onClick={() => go(now.next)} className="btn-lip mt-2 min-h-11 w-full rounded-xl bg-accent text-[15px] font-extrabold text-on-accent">NEXT</button>}
          <div className="mt-2 flex justify-center gap-4 text-[13.5px] font-medium text-fg-2">
            {path.length > 1 && <button type="button" onClick={restart} className="underline">Start again</button>}
            <button type="button" onClick={() => setWalking(false)} className="underline">See whole chart</button>
          </div>
        </div>
      )}
    </div>
  );
}
