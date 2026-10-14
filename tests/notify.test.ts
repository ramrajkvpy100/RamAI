import { afterEach, describe, expect, it, vi } from "vitest";

import { notifyOwner } from "@/server/notify-owner";

process.env.RAMAI_DB_PATH = ":memory:";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
});

describe("the owner hears about new suggestions", () => {
  it("by email through Resend, to the owner's address, with a link to answer it", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const sent: { url: string; body: { to: string[]; subject: string; text: string } }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: { body: string }) => {
      sent.push({ url, body: JSON.parse(init.body) });
      return Response.json({ id: "email_1" });
    }));
    const r = await notifyOwner({ subject: "New suggestion · idea", text: "A guest on /practice:\n\nAdd more ECGs", url: "/admin/suggestions" });
    expect(r.email).toBe(true);
    expect(sent[0]!.url).toBe("https://api.resend.com/emails");
    expect(sent[0]!.body.to).toContain("ramrajkansana100@gmail.com");
    expect(sent[0]!.body.text).toContain("Add more ECGs");
    expect(sent[0]!.body.text).toContain("/admin/suggestions");
  });

  it("without an email key, nothing breaks", async () => {
    expect((await notifyOwner({ subject: "x", text: "y", url: "/" })).email).toBe(false);
  });
});
