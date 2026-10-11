/**
 * The suggestions migration on a real Postgres (PGlite), with Supabase's auth
 * pieces stood in for: the permission rules are checked as each kind of user.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { PGlite, type Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATION = readFileSync("supabase/migrations/20261011000000_suggestions.sql", "utf8");
const OWNER = "ramrajkansana100@gmail.com";

let pg: PGlite;
const owner = randomUUID();
const asha = randomUUID();
const kabir = randomUUID();

/** Runs SQL as a signed-in Supabase user (role "authenticated", auth.uid() = id), or as "anon". */
async function as<T = Record<string, unknown>>(who: string | "anon", sql: string, params: unknown[] = []) {
  return pg.transaction(async (tx: Transaction) => {
    if (who === "anon") await tx.exec("set local role anon");
    else {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [who]);
    }
    return (await tx.query<T>(sql, params)).rows;
  });
}
const addUser = (id: string, email: string, confirmed = true) => pg.query("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)", [id, email, confirmed ? new Date() : null]);

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await addUser(asha, "asha@example.com");
  await addUser(kabir, "kabir@example.com");
  await pg.exec(MIGRATION);
  // Re-running is safe.
  await pg.exec(MIGRATION);
}, 60_000);

const send = (who: string, message: string, extra: Record<string, unknown> = {}) =>
  as(
    who,
    `insert into public.suggestions (name, email, category, message, page, status, reply${extra.user_id ? ", user_id" : ""})
     values ($1, $2, $3, $4, $5, $6, $7${extra.user_id ? ", $8" : ""}) returning id, status, reply, user_id`,
    ["Dr. A", "a@example.com", "idea", message, "/", extra.status ?? "new", extra.reply ?? null, ...(extra.user_id ? [extra.user_id] : [])],
  );

describe("who is an admin", () => {
  it("the owner becomes one once their email is confirmed — nobody else", async () => {
    await addUser(owner, OWNER, false);
    expect((await as(owner, "select public.is_admin() as admin"))[0]).toEqual({ admin: false });
    await pg.query("update auth.users set email_confirmed_at = now() where id = $1", [owner]);
    expect((await as(owner, "select public.is_admin() as admin"))[0]).toEqual({ admin: true });
    expect((await as(asha, "select public.is_admin() as admin"))[0]).toEqual({ admin: false });
  });

  it("can't be granted through the API", async () => {
    await expect(as(asha, "insert into public.admins (user_id) values ($1)", [asha])).rejects.toThrow(/permission denied|row-level security/);
    expect(await as(asha, "select * from public.admins")).toEqual([]);
  });
});

describe("players", () => {
  it("send suggestions as themselves; status and answer always start empty", async () => {
    const [row] = await send(asha, "Please add more paediatric emergency cases.", { status: "done", reply: "Sure!" });
    expect(row).toMatchObject({ status: "new", reply: null, user_id: asha });
  });

  it("can't send one in someone else's name", async () => {
    await expect(send(asha, "Pretending to be Kabir here.", { user_id: kabir })).rejects.toThrow(/row-level security/);
  });

  it("see only their own", async () => {
    await send(kabir, "The ECG viewer could zoom further.");
    const mine = await as<{ user_id: string }>(asha, "select user_id from public.suggestions");
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((r) => r.user_id === asha)).toBe(true);
  });

  it("can't answer, change or delete them", async () => {
    expect(await as(asha, "update public.suggestions set status = 'done', reply = 'self-answer' returning id")).toEqual([]);
    expect(await as(asha, "delete from public.suggestions returning id")).toEqual([]);
  });

  it("must write something real", async () => {
    await expect(send(asha, "short")).rejects.toThrow(/check constraint/);
  });
});

describe("admins", () => {
  it("see everyone's, answer them, and can't rewrite what was sent", async () => {
    const all = await as<{ id: string; user_id: string; message: string }>(owner, "select id, user_id, message from public.suggestions order by created_at");
    expect(new Set(all.map((r) => r.user_id))).toEqual(new Set([asha, kabir]));
    const target = all.find((r) => r.user_id === asha)!;
    const [answered] = await as<{ status: string; reply: string; replied_at: Date | null; message: string }>(
      owner,
      "update public.suggestions set status = 'planned', reply = 'Coming in November.', message = 'edited' where id = $1 returning status, reply, replied_at, message",
      [target.id],
    );
    expect(answered).toMatchObject({ status: "planned", reply: "Coming in November.", message: target.message });
    expect(answered!.replied_at).toBeInstanceOf(Date);
    // The player sees the answer.
    expect((await as<{ reply: string }>(asha, "select reply from public.suggestions where id = $1", [target.id]))[0]?.reply).toBe("Coming in November.");
  });

  it("delete them", async () => {
    const [row] = await as<{ id: string }>(owner, "select id from public.suggestions where user_id = $1", [kabir]);
    expect(await as(owner, "delete from public.suggestions where id = $1 returning id", [row!.id])).toEqual([{ id: row!.id }]);
  });

  it("only allow known statuses", async () => {
    const [row] = await as<{ id: string }>(owner, "select id from public.suggestions limit 1");
    await expect(as(owner, "update public.suggestions set status = 'whatever' where id = $1", [row!.id])).rejects.toThrow(/check constraint/);
  });
});

describe("visitors who aren't signed in", () => {
  it("can neither read nor write suggestions", async () => {
    await expect(as("anon", "select * from public.suggestions")).rejects.toThrow(/permission denied/);
    await expect(as("anon", "insert into public.suggestions (name, email, category, message) values ('x', 'x@x.io', 'idea', 'ten chars!!')")).rejects.toThrow(/permission denied/);
  });
});
