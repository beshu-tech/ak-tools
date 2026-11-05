import { describe, expect, it } from "vite-plus/test";
import { describeValidity, humanSpan } from "./validity";

const NOW = new Date(2026, 5, 15, 12, 0, 0);
const at = (...args: [number, number, number, number?, number?]) =>
  new Date(args[0], args[1], args[2], args[3] ?? 12, args[4] ?? 0, 0);

describe("humanSpan", () => {
  it.each([
    [at(2027, 5, 15), "1 year"],
    [at(2028, 8, 20), "2 years, 3 months and 5 days"],
    [at(2026, 7, 15), "2 months"],
    [at(2026, 6, 16), "1 month and 1 day"],
    [at(2026, 5, 16), "1 day"],
    [at(2026, 5, 20), "5 days"],
    [at(2026, 5, 15, 17, 30), "5 hours and 30 minutes"],
    [at(2026, 5, 15, 12, 45), "45 minutes"],
    [at(2026, 5, 15, 12, 0), "less than a minute"],
  ])("%s -> %s", (to, expected) => {
    expect(humanSpan(NOW, to)).toBe(expected);
  });

  it("is symmetric: the order of the two dates does not matter", () => {
    expect(humanSpan(at(2028, 8, 20), NOW)).toBe(humanSpan(NOW, at(2028, 8, 20)));
  });

  it("keeps only the three largest units when several are present", () => {
    // 1 year, 2 months, 3 days and 4 hours: hours are dropped
    expect(humanSpan(NOW, at(2027, 7, 18, 16))).toBe("1 year, 2 months and 3 days");
  });
});

describe("describeValidity", () => {
  it("no exp: never expires", () => {
    expect(describeValidity(null, NOW)).toEqual({ state: "no-expiry" });
    expect(describeValidity(undefined, NOW)).toEqual({ state: "no-expiry" });
  });

  it("a future exp is valid for a span, until that date", () => {
    expect(describeValidity(at(2028, 8, 20), NOW)).toEqual({
      state: "valid",
      span: "2 years, 3 months and 5 days",
      until: at(2028, 8, 20),
    });
  });

  it("a past exp is expired since that date, for a span", () => {
    expect(describeValidity(at(2026, 5, 10), NOW)).toEqual({
      state: "expired",
      span: "5 days",
      since: at(2026, 5, 10),
    });
  });

  it("an exp equal to now counts as expired", () => {
    expect(describeValidity(NOW, NOW).state).toBe("expired");
  });
});
