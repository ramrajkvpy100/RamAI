import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createGuest, createProfile, type User } from "@/server/auth";
import { createPost, createReply, getPost, listPosts, remove, report, toggleLike } from "@/server/community";
import { db } from "@/server/db";
import { deleteAccount } from "@/server/privacy";

process.env.RAMAI_DB_PATH = ":memory:";

let meera: User;
let arjun: User;
const others: User[] = [];

beforeAll(async () => {
  meera = await createProfile({ email: "meera@example.com", username: "meera", name: "Dr. Meera Iyer" });
  arjun = await createProfile({ email: "arjun@example.com", username: "arjun", name: "Arjun Rao" });
  for (const n of [1, 2, 3]) others.push(await createProfile({ email: `r${n}@example.com`, username: `reader${n}`, name: `Reader ${n}` }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENAI_API_KEY;
});

describe("the community", () => {
  it("open to everyone: a guest posts and replies, told apart by a tag; an account posts, replies, likes", async () => {
    const guest = await createGuest();
    const asGuest = await createPost(guest, { topic: "questions", title: "Can guests post?", body: "Trying from a guest session." });
    const guestReply = await createReply(guest, asGuest.id, "Yes — and reply too.");
    expect(guestReply.author.name).toMatch(/^Guest doctor · [0-9a-f]{4}$/);

    const { id } = await createPost(meera, { topic: "neet-pg", title: "Best way to revise ECGs?", body: "I keep mixing up the bundle branch blocks. How do you revise them?" });
    const reply = await createReply(arjun, id, "Draw V1 and V6 for each — RBBB is M in V1, LBBB is M in V6.");
    expect(reply.author).toMatchObject({ name: "Arjun Rao", rankLabel: "Medical Student" });

    const liked = await toggleLike(guest, `p:${id}`);
    expect(liked).toEqual({ liked: true, likes: 1 });
    expect(await toggleLike(guest, `p:${id}`)).toEqual({ liked: false, likes: 0 });

    const { posts } = await listPosts({ topic: "neet-pg", viewerId: meera.id });
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ title: "Best way to revise ECGs?", replies: 1, mine: true });
    expect((await listPosts({ topic: "usmle" })).posts).toHaveLength(0);
    expect((await getPost(id, arjun.id))!.replyList[0]).toMatchObject({ mine: true });
  });

  it("three reports hide a post until an admin looks; one person counts once", async () => {
    const { id } = await createPost(arjun, { topic: "general", title: "Selling notes, DM me", body: "Cheap notes for sale, message me on WhatsApp." });
    await report(others[0]!, `p:${id}`);
    await report(others[0]!, `p:${id}`);
    await report(others[1]!, `p:${id}`);
    expect(await getPost(id)).not.toBeNull();
    await report(others[2]!, `p:${id}`);
    expect(await getPost(id)).toBeNull();
  });

  it("you remove your own — not someone else's (unless you're an admin)", async () => {
    const { id } = await createPost(meera, { topic: "questions", title: "Repeat troponin when?", body: "When do you repeat a high-sensitivity troponin?" });
    await expect(remove(arjun, `p:${id}`)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await remove(arjun, `p:${id}`, true);
    expect(await getPost(id)).toBeNull();
  });

  it("the model keeps out what shouldn't be posted, with a reason for the author", async () => {
    process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(40);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ choices: [{ message: { content: JSON.stringify({ allowed: false, message: "Please remove the patient's name and phone number." }) } }] })));
    await expect(createPost(meera, { topic: "cases", title: "Interesting patient today", body: "Ramesh Kumar, 9876543210, has a large liver abscess." })).rejects.toMatchObject({ code: "BLOCKED", message: "Please remove the patient's name and phone number." });
  });

  it("deleting an account takes its posts, replies and likes with it", async () => {
    const { id } = await createPost(arjun, { topic: "general", title: "Goodbye post here", body: "This account is about to be deleted." });
    await createReply(meera, id, "Sad to see you go.");
    const { id: other } = await createPost(meera, { topic: "general", title: "Staying around", body: "Still here, still revising." });
    await toggleLike(arjun, `p:${other}`);
    await deleteAccount(arjun.id);
    expect(await getPost(id)).toBeNull();
    expect((await getPost(other))!.likes).toBe(0);
    expect(await db.get("SELECT 1 AS x FROM replies WHERE post_id = ?", id)).toBeUndefined();
  });
});
