import { z } from "zod";

import { allowEmail, createCodes, listAccess, removeEmail, revokeCode } from "@/server/access";
import { getCurrentUser } from "@/server/auth";
import { isAdmin } from "@/server/suggestions";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("codes"), count: z.number().int().min(1).max(50), label: z.string().trim().min(1).max(60), maxUses: z.number().int().min(1).max(500) }),
  z.object({ action: z.literal("revoke"), code: z.string().trim().max(20) }),
  z.object({ action: z.literal("allow"), email: z.string().trim().email().max(200) }),
  z.object({ action: z.literal("remove"), email: z.string().trim().max(200) }),
]);

async function admin() {
  const user = await getCurrentUser();
  return user && (await isAdmin(user)) ? user : null;
}

/** GET /api/access/admin — invite codes and allowed emails (admins only). */
export async function GET() {
  try {
    if (!(await admin())) return apiError(404, "NOT_FOUND", "Not found.");
    return ok(await listAccess());
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/access/admin — make codes, revoke one, allow or remove an email (admins only). */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 30);
  if (blocked) return blocked;
  const body = await parseBody(req, Action);
  if (body instanceof Response) return body;
  try {
    if (!(await admin())) return apiError(404, "NOT_FOUND", "Not found.");
    if (body.action === "codes") return ok({ codes: await createCodes(body.count, body.label, body.maxUses) });
    if (body.action === "revoke") await revokeCode(body.code);
    if (body.action === "allow") await allowEmail(body.email);
    if (body.action === "remove") await removeEmail(body.email);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
