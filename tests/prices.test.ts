import { describe, expect, it } from "vitest";

import { countryFromIp, formatPrice, priceFor, priceList } from "@/lib/plans";

describe("Pro is priced in the country's own currency", () => {
  it("rupees in India, dollars in the USA, pounds in the UK — in the smallest unit for the payment provider", () => {
    expect(priceFor("IN", "monthly")).toMatchObject({ label: "₹299", minor: 29_900, currency: "INR", days: 30 });
    expect(priceFor("IN", "yearly")).toMatchObject({ label: "₹2,499", perMonth: "₹208", saving: 30, days: 365 });
    expect(priceFor("US", "monthly")).toMatchObject({ label: "$4.99", minor: 499, currency: "USD" });
    expect(priceFor("US", "yearly")).toMatchObject({ label: "$39.99", perMonth: "$3.33", saving: 33 });
    expect(priceFor("UK", "yearly")).toMatchObject({ label: "£31.99", minor: 3_199, currency: "GBP", perMonth: "£2.67" });
    expect(formatPrice(0, "US")).toBe("$0");
  });

  it("a visitor sees their own country's prices; anywhere else, dollars", () => {
    expect([countryFromIp("IN"), countryFromIp("GB"), countryFromIp("CA"), countryFromIp(null)]).toEqual(["IN", "UK", "US", "IN"]);
  });

  it("the terms and refund policy list every country's price", () => {
    expect(priceList("monthly")).toBe("₹299 (India), $4.99 (USA) or £3.99 (UK)");
  });
});
