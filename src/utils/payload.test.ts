import { describe, expect, it } from "vite-plus/test";
import { fakeToken } from "../test/fixtures";
import {
  canGenerate,
  claimDate,
  deriveDraft,
  parsePayload,
  samePayload,
  signingStatus,
  withClaimDate,
} from "./payload";

describe("parsePayload", () => {
  it("accepts JSON objects only", () => {
    expect(parsePayload('{"a":1}')).toEqual({ a: 1 });
    for (const bad of ["", "{", "[1]", "42", "null", '"x"']) expect(parsePayload(bad)).toBeNull();
  });
});

describe("samePayload", () => {
  it("ignores key order and nesting order", () => {
    expect(samePayload({ a: 1, b: { x: 1, y: 2 } }, { b: { y: 2, x: 1 }, a: 1 })).toBe(true);
  });
  it("sees value differences, including in arrays", () => {
    expect(samePayload({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(samePayload({ a: 1 }, { a: 2 })).toBe(false);
    expect(samePayload({ a: 1 }, { a: 1, b: 1 })).toBe(false);
  });
});

describe("withClaimDate", () => {
  it("writes the picked day and keeps the time of day of the old claim", () => {
    const old = new Date(2026, 0, 10, 15, 30, 45);
    const json = JSON.stringify({ sub: "x", exp: Math.floor(old.getTime() / 1000) });
    const next = parsePayload(withClaimDate(json, "exp", new Date(2027, 5, 20))!)!;
    const date = claimDate(next, "exp")!;
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2027, 5, 20]);
    expect([date.getHours(), date.getMinutes(), date.getSeconds()]).toEqual([15, 30, 45]);
    expect(next.sub).toBe("x");
  });

  it("adds a missing claim at midnight and keeps other claims in place", () => {
    const next = withClaimDate('{"a":1}', "iat", new Date(2026, 2, 5, 9, 9))!;
    expect(next).toContain('\n  "a": 1');
    const date = claimDate(parsePayload(next)!, "iat")!;
    expect([date.getDate(), date.getHours()]).toEqual([5, 9]);
  });

  it("returns null for text that is not a JSON object", () => {
    expect(withClaimDate("{broken", "exp", new Date())).toBeNull();
  });
});

describe("deriveDraft", () => {
  const token = fakeToken({ alg: "ES512" }, { sub: "x", exp: 4_000_000_000 });

  it("is clean when the editor holds the token's claims, however formatted", () => {
    expect(deriveDraft('{"exp":4000000000,"sub":"x"}', token).hasEdits).toBe(false);
    expect(deriveDraft('{\n  "sub": "x",\n  "exp": 4000000000\n}', token).hasEdits).toBe(false);
  });
  it("has edits when a claim changes", () => {
    expect(deriveDraft('{"sub":"y","exp":4000000000}', token).hasEdits).toBe(true);
  });
  it("has edits and no payload when the text is not valid", () => {
    expect(deriveDraft("{", token)).toEqual({ payload: null, hasEdits: true });
  });
});

describe("signingStatus / canGenerate", () => {
  const clean = { payload: { a: 1 }, hasEdits: false };
  const edited = { payload: { a: 1 }, hasEdits: true };
  const cases = [
    [
      { draft: { payload: null, hasEdits: true }, hasSigningKey: true, signatureMismatch: false },
      "invalid-json",
      false,
    ],
    [{ draft: edited, hasSigningKey: false, signatureMismatch: false }, "no-key", false],
    [{ draft: edited, hasSigningKey: true, signatureMismatch: false }, "edited", true],
    [{ draft: edited, hasSigningKey: true, signatureMismatch: true }, "edited", true],
    [{ draft: clean, hasSigningKey: true, signatureMismatch: true }, "key-mismatch", true],
    [{ draft: clean, hasSigningKey: true, signatureMismatch: false }, "up-to-date", false],
  ] as const;
  it.each(cases)("%j -> %s", (input, status, generate) => {
    expect(signingStatus(input)).toBe(status);
    expect(canGenerate(status)).toBe(generate);
  });
});
