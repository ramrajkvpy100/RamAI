/**
 * Suggestions, end to end: players send them (stored in Supabase as
 * themselves), the admin reviews, answers and tidies them up, the player sees
 * the answer — and nobody else gets in.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Browser, E2E, signUp, startStack, type Stack } from "./harness";

describe.skipIf(!E2E)("suggestions end to end (Supabase stand-in)", () => {
  let stack: Stack;
  let player: Browser;
  let other: Browser;
  let admin: Browser;

  beforeAll(async () => {
    stack = await startStack(3298);
    player = await signUp(stack, { email: "player.one@example.com", username: "player.one", name: "Dr. Player One" });
    other = await signUp(stack, { email: "player.two@example.com", username: "player.two", name: "Dr. Player Two" });
    admin = await signUp(stack, { email: "admin.doc@example.com", username: "admin.doc", name: "Dr. Admin" });
    stack.auth.makeAdmin("admin.doc@example.com");
  }, 90_000);
  afterAll(async () => stack?.stop());

  let id = "";

  it("a player sends a suggestion; it's stored in Supabase as them", async () => {
    const res = await player.api("/api/suggestions", { category: "case", message: "Please add a snakebite case for district hospitals.", page: "/suggestions" });
    expect(res.status).toBe(200);
    const s = res.body.suggestion as { id: string; status: string; reply: null };
    expect(s).toMatchObject({ status: "new", reply: null });
    id = s.id;
    const stored = stack.auth.suggestions.find((r) => r.id === id)!;
    expect(stored).toMatchObject({ name: "Dr. Player One", email: "player.one@example.com", category: "case" });
    expect(stored.user_id).toBe(stack.auth.users.get("player.one@example.com")!.id);
  });

  it("checks what's sent", async () => {
    expect(await player.api("/api/suggestions", { category: "idea", message: "too short" })).toMatchObject({ status: 400, code: "BAD_INPUT" });
    expect(await player.api("/api/suggestions", { category: "rant", message: "A perfectly long enough message." })).toMatchObject({ status: 400 });
  });

  it("players see only their own", async () => {
    await other.api("/api/suggestions", { category: "problem", message: "The ECG viewer could zoom further on phones." });
    const mine = (await player.api("/api/suggestions")).body.items as { id: string }[];
    expect(mine.map((s) => s.id)).toEqual([id]);
  });

  it("guests and signed-out visitors can't send any", async () => {
    const guest = new Browser(stack.base);
    await guest.api("/api/auth/guest", {});
    expect(await guest.api("/api/suggestions", { category: "idea", message: "A guest trying to get in here." })).toMatchObject({ status: 403, code: "SIGNUP_REQUIRED" });
    expect((await new Browser(stack.base).api("/api/suggestions", { category: "idea", message: "Nobody signed in at all." })).status).toBe(401);
  });

  it("only the admin can open the admin list — the page and the API", async () => {
    expect((await player.api("/api/admin/suggestions")).status).toBe(404);
    expect((await player.go("/admin/suggestions")).status).toBe(404);
    const list = await admin.api("/api/admin/suggestions");
    expect(list.status).toBe(200);
    expect((list.body.items as unknown[]).length).toBe(2);
    expect(list.body.counts).toMatchObject({ all: 2, new: 2 });
    const page = await admin.go("/admin/suggestions");
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("snakebite");
  });

  it("the admin filters and searches", async () => {
    expect(((await admin.api("/api/admin/suggestions?category=case")).body.items as unknown[]).length).toBe(1);
    expect(((await admin.api("/api/admin/suggestions?q=ECG")).body.items as { message: string }[])[0]?.message).toContain("ECG");
  });

  it("the admin answers; the player sees the answer; nobody else can answer", async () => {
    expect((await player.api(`/api/admin/suggestions/${id}`, { status: "done", reply: "self-answer" }, "PATCH")).status).toBe(404);
    const answered = await admin.api(`/api/admin/suggestions/${id}`, { status: "planned", reply: "Coming in November — thank you!" }, "PATCH");
    expect(answered.status).toBe(200);
    expect(answered.body.suggestion).toMatchObject({ status: "planned", reply: "Coming in November — thank you!" });
    const mine = (await player.api("/api/suggestions")).body.items as { status: string; reply: string; repliedAt: string }[];
    expect(mine[0]).toMatchObject({ status: "planned", reply: "Coming in November — thank you!" });
    expect(mine[0]!.repliedAt).toBeTruthy();
    expect((await admin.api("/api/admin/suggestions?status=planned")).body.counts).toMatchObject({ planned: 1, new: 1 });
  });

  it("the admin's menu shows how many are new", async () => {
    const me = (await admin.api("/api/me")).body as { admin?: boolean; newSuggestions?: number };
    expect(me).toMatchObject({ admin: true, newSuggestions: 1 });
    expect(((await player.api("/api/me")).body as { admin?: boolean }).admin).toBeUndefined();
  });

  it("the admin deletes; players can't", async () => {
    expect((await player.api(`/api/admin/suggestions/${id}`, undefined, "DELETE")).status).toBe(404);
    expect((await admin.api(`/api/admin/suggestions/${id}`, undefined, "DELETE")).status).toBe(200);
    expect(stack.auth.suggestions.find((r) => r.id === id)).toBeUndefined();
    expect((await admin.api(`/api/admin/suggestions/${id}`, undefined, "DELETE")).status).toBe(404);
  });

  it("says so plainly if the Supabase table hasn't been created", async () => {
    stack.auth.setSuggestionsTable(false);
    expect(await player.api("/api/suggestions", { category: "idea", message: "Is this switched on yet?" })).toMatchObject({ status: 503, code: "SUGGESTIONS_UNAVAILABLE" });
    stack.auth.setSuggestionsTable(true);
  });
});
