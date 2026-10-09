"use client";

import { cn } from "@/lib/cn";
import type { ToolCategory, ToolItem } from "@/lib/tool-menus";

/** Compact chip grid for one tool category. */
export function ToolMenu({ category, onPick, dense = false }: { category: ToolCategory; onPick: (item: ToolItem) => void; dense?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {category.groups.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-1.5">
          {group.title && <div className="micro text-fg-3">{group.title}</div>}
          <div className="flex flex-wrap gap-1.5">
            {group.items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onPick(item)}
                className={cn(
                  "rounded-md border border-line bg-surface px-2.5 text-left text-ui text-fg transition-[background-color,border-color] duration-150 hover:border-accent-line hover:bg-accent-soft",
                  dense ? "h-7" : "h-8",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
