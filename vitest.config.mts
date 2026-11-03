import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside React Server Components; tests run on the server anyway.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    env: { RAMAI_NO_PERIOD_PROMPT: "1" },
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The audits call the real AI (they cost credits): run only on purpose: `AUDIT=1 npx vitest run tests/audit/compare.test.ts`.
    exclude: process.env.AUDIT ? [] : ["tests/audit/**", "**/node_modules/**"],
  },
});
