import { describe, expect, it } from "vitest";

import { countryFromIp, formatPrice, priceFor, priceList } from "@/lib/plans";

describe("Pro is priced in the country's own currency", () => {
  it("rupees in India, dollars in the USA, pounds in the UK — in the smallest unit for the payment provider", () => {
    expect(priceFor("IN", "monthly")).toMatchObject({ label: "₹299", minor: 29_900, currency: "INR", days: 30 });
    expect(priceFor("US", "monthly")).toMatchObject({ label: "$4.99", minor: 499, currency: "USD" });
    expect(priceFor("UK", "monthly")).toMatchObject({ label: "£3.99", minor: 399, currency: "GBP", per: "month" });
    expect(formatPrice(0, "US")).toBe("$0");
  });

  it("a visitor sees their own country's prices; anywhere else, dollars", () => {
    expect([countryFromIp("IN"), countryFromIp("GB"), countryFromIp("CA"), countryFromIp(null)]).toEqual(["IN", "UK", "US", "IN"]);
  });

  it("the terms and refund policy list every country's price", () => {
    expect(priceList("monthly")).toBe("₹299 (India), $4.99 (USA) or £3.99 (UK)");
  });
});
