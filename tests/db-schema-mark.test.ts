import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { MIGRATIONS_VERSION } from "@/server/db";

// Changed migrate() in src/server/db.ts? Bump MIGRATIONS_VERSION so production runs it, then update both values here.
it("a change to the migrations bumps their version", () => {
  const src = readFileSync("src/server/db.ts", "utf8");
  const body = src.slice(src.indexOf("async function migrate(b: Backend)"), src.indexOf("export async function tx<T>"));
  expect(createHash("sha256").update(body).digest("hex").slice(0, 16)).toBe("0b9b5e7b73f55114");
  expect(MIGRATIONS_VERSION).toBe(1);
});
