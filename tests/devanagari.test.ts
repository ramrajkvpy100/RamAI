import { describe, expect, it } from "vitest";

import { toDevanagari } from "@/lib/devanagari";

describe("Hinglish read by a Hindi voice", () => {
  it("is written in Devanagari — everyday words exactly, the rest phonetically", () => {
    expect(toDevanagari("Mujhe bahut pyaas lag rahi hai.")).toBe("मुझे बहुत प्यास लग रही है.");
    expect(toDevanagari("Doctor, pet mein dard hai!")).toBe("डॉक्टर, पेट में दर्द है!");
    expect(toDevanagari("Nahin, kuch nahi khaya")).toBe("नहीं, कुछ नहीं खाया");
    expect(toDevanagari("Mera BP check karo")).toBe("मेरा बीपी चेक करो");
    expect(toDevanagari("ECG ho gaya")).toBe("ECG हो गया");
  });
});
