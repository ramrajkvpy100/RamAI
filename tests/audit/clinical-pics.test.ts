import { readFileSync } from "node:fs";
import { it } from "vitest";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, ""); }
process.env.RAMAI_DB_PATH = "/private/tmp/claude-501/-Users-rsk-Startup/a0103bfd-fc22-4950-9d58-89d9ac74e3bc/scratchpad/clin.db";
it("clinical pictures", { timeout: 300_000 }, async () => {
  const { addPicture } = await import("@/server/practice");
  for (const id of ["psoriasis", "zoster", "clubbing", "scabies", "vitiligo", "goitre"]) { const t = Date.now(); const ok = await addPicture("clinical", id).catch((e) => `ERR ${(e as Error).message}`); console.log(id, ok, Date.now() - t, "ms"); }
});
