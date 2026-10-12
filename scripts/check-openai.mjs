/**
 * Checks the OpenAI connection from this computer, using the key in .env.local.
 *   node scripts/check-openai.mjs
 * Prints whether it works — never the key itself.
 */
import { checkOpenAI } from "../src/lib/server/openai-check.ts";

try {
  process.loadEnvFile(".env.local");
} catch {
  console.log("✗ No .env.local file found in this folder.");
  process.exit(1);
}

const result = await checkOpenAI(process.env);
if (result.ok) {
  console.log(`✓ OpenAI is connected. Model: ${result.model}. Its reply: “${result.reply}” (${result.ms} ms).`);
} else {
  console.log(`✗ Not working yet: ${result.problem}`);
  if (result.models?.length) console.log(`  Chat models this key can use: ${result.models.slice(0, 30).join(", ")}`);
}
process.exit(result.ok ? 0 : 1);
