import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PersonaArt } from "@/components/game/avatar-personas";
import { PersonaAvatar } from "@/components/game/specialist-avatar";
import { cleanPhoto, DEFAULT_AVATAR, outfitFor, parseAvatar, PERSONAS, PHOTO, publicAvatar } from "@/lib/avatar-style";

const PIC = "https://lh3.googleusercontent.com/a/abc123=s96-c";

describe("stored avatars", () => {
  it("reads a row from before personas as the same cartoon, with no persona", () => {
    const old = { skin: 4, hair: "hijab", hairColor: 2, eyes: "happy", mouth: "grin", extra: "goldscope", bg: 5, outfit: 3 };
    const parsed = parseAvatar(old)!;
    expect(parsed).toEqual(old);
    expect(parsed.persona).toBeUndefined();
    expect(publicAvatar(parsed)).toBeNull();
    expect(outfitFor(parsed, 8)).toBe(3);
  });

  it("still reads the oldest rows, without an outfit", () => {
    const { outfit, ...rest } = parseAvatar({ ...DEFAULT_AVATAR })!;
    expect(outfit).toBe(-1);
    expect(rest).toEqual(DEFAULT_AVATAR);
  });

  it("keeps a persona beside the cartoon's pieces", () => {
    for (const p of PERSONAS) {
      const parsed = parseAvatar({ skin: 1, hair: "bun", persona: p.id })!;
      expect(parsed.persona).toBe(p.id);
      expect(parsed.skin).toBe(1);
      expect(parsed.hair).toBe("bun");
      expect(publicAvatar(parsed)).toEqual({ persona: p.id });
    }
  });

  it("drops a persona it doesn't know and goes back to the cartoon", () => {
    expect(parseAvatar({ persona: "wizard" })!.persona).toBeUndefined();
    expect(parseAvatar({ persona: 7 })!.persona).toBeUndefined();
  });

  it("takes a photo only from Google's picture host", () => {
    expect(cleanPhoto(PIC)).toBe(PIC);
    for (const bad of ["https://evil.example/a.png", "http://lh3.googleusercontent.com/a", "https://lh3.googleusercontent.com.evil.example/a", 'https://lh3.googleusercontent.com/a"onerror=x', "https://lh3.googleusercontent.com/a b", `https://lh3.googleusercontent.com/${"a".repeat(500)}`, 5, null]) {
      expect(cleanPhoto(bad)).toBeUndefined();
    }
    expect(parseAvatar({ persona: PHOTO, photo: "https://evil.example/a.png" })!.persona).toBeUndefined();
    const ok = parseAvatar({ persona: PHOTO, photo: PIC })!;
    expect(ok.persona).toBe(PHOTO);
    expect(publicAvatar(ok)).toEqual({ persona: PHOTO, photo: PIC });
    // A photo left behind by another choice isn't kept or shown.
    expect(parseAvatar({ persona: "radiology-ace", photo: PIC })!.photo).toBeUndefined();
  });

  it("marks a row that only holds defaults, so there's no cartoon to offer back", () => {
    expect(parseAvatar({ ...DEFAULT_AVATAR, auto: true })!.auto).toBe(true);
    expect(parseAvatar({ ...DEFAULT_AVATAR, auto: "yes" })!.auto).toBeUndefined();
    expect(parseAvatar(null)).toBeNull();
  });
});

describe("persona drawings", () => {
  it("has sixteen, each its own, complete and self-contained", () => {
    expect(PERSONAS).toHaveLength(16);
    expect(new Set(PERSONAS.map((p) => p.id)).size).toBe(16);
    const drawn = PERSONAS.map((p) => renderToStaticMarkup(createElement(PersonaArt, { persona: p.id, size: 96 })));
    for (const svg of drawn) {
      expect(svg).toContain("<svg");
      expect(svg).toContain("linearGradient");
      expect(svg).not.toMatch(/undefined|NaN|<image|href=|https?:\/\/(?!www\.w3\.org)/);
    }
    expect(new Set(drawn.map((s) => s.replace(/\bp[a-z-]+[fdsc]\b/g, ""))).size).toBe(16);
  });

  it("stays small", () => {
    const total = PERSONAS.reduce((n, p) => n + renderToStaticMarkup(createElement(PersonaArt, { persona: p.id })).length, 0);
    expect(total).toBeLessThan(120_000);
  });
});

describe("PersonaAvatar", () => {
  const html = (props: Parameters<typeof PersonaAvatar>[0]) => renderToStaticMarkup(createElement(PersonaAvatar, props));

  it("holds the place in the persona's colour before the drawings arrive (nothing heavy in the first HTML)", () => {
    const out = html({ persona: "radiology-ace", size: 28 });
    expect(out).toContain("width:28px");
    expect(out).not.toContain("<svg");
  });

  it("asks Google for twice the size, without a referrer", () => {
    const out = html({ persona: PHOTO, photo: PIC, size: 96 });
    expect(out).toContain("=s192-c");
    expect(out).toContain('referrerPolicy="no-referrer"');
  });

  it("draws the fallback for anything else", () => {
    const fallback = createElement("i", null, "AB");
    expect(html({ persona: null, fallback })).toBe("<i>AB</i>");
    expect(html({ persona: "wizard", fallback })).toBe("<i>AB</i>");
    expect(html({ persona: PHOTO, fallback })).toBe("<i>AB</i>");
  });
});
