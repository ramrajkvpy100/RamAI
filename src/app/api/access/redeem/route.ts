import { NextResponse } from "next/server";
import { z } from "zod";

import { redeemCode } from "@/server/access";
import { ACCESS_COOKIE, makeAccessCookie } from "@/lib/server/access-cookie";
import { apiError, crossSite, handleError, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";

const Schema = z.object({ code: z.string().trim().min(6).max(20) });

/** POST /api/access/redeem — an invite code, used once: this browser is let in (then signs up). */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const body = await parseBody(req, Schema);
  if (body instanceof Response) return body;
  try {
    if (!(await redeemCode(body.code))) return apiError(400, "INVALID", "That invite code isn't valid or has already been used.");
    const pass = await makeAccessCookie();
    const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    res.cookies.set(ACCESS_COOKIE, pass.value, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: pass.maxAge });
    return res;
  } catch (err) {
    return handleError(err);
  }
}
