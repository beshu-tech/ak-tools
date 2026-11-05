import * as jose from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import type { KeyPair } from "../types/activationKey";
import { fakeToken, makeKeyPair, SEC1_PRIVATE_KEY, signToken } from "../test/fixtures";
import {
  decodeJWT,
  extractPublicKeyFromPrivate,
  formatJwtDisplay,
  formatRelativeTime,
  generateEC512KeyPair,
  getJwtMetadata,
  signJWT,
  validateActivationKeyFormat,
  validateJWTSignature,
} from "./activationKey";

let keyPair: KeyPair;
let otherKeyPair: KeyPair;
beforeAll(async () => {
  keyPair = await makeKeyPair("primary");
  otherKeyPair = await makeKeyPair("other");
});

const NOW_S = () => Math.floor(Date.now() / 1000);

describe("getJwtMetadata", () => {
  it("extracts algorithm, iat and exp as Dates", async () => {
    const token = await signToken(
      keyPair,
      { sub: "x" },
      { iat: 1_700_000_000, exp: 1_800_000_000 },
    );
    const meta = getJwtMetadata(token);
    expect(meta?.algorithm).toBe("ES512");
    expect(meta?.issuedAt).toEqual(new Date(1_700_000_000_000));
    expect(meta?.expiresAt).toEqual(new Date(1_800_000_000_000));
  });

  it("returns null dates when claims are absent", () => {
    const meta = getJwtMetadata(fakeToken({ alg: "ES512" }, { sub: "x" }));
    expect(meta).toEqual({ algorithm: "ES512", issuedAt: null, expiresAt: null });
  });

  it("returns null for garbage", () => {
    expect(getJwtMetadata("")).toBeNull();
    expect(getJwtMetadata("not-a-jwt")).toBeNull();
    expect(getJwtMetadata("a.b.c")).toBeNull();
  });
});

describe("validateActivationKeyFormat", () => {
  const header = { alg: "ES512", typ: "JWT" };

  it("accepts a real signed key and returns metadata", async () => {
    const token = await signToken(keyPair, { sub: "x" }, { exp: NOW_S() + 3600 });
    const result = validateActivationKeyFormat(token);
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.metadata.algorithm).toBe("ES512");
      expect(result.metadata.expiresAt).toBeInstanceOf(Date);
    }
  });

  it("trims surrounding whitespace", async () => {
    const token = await signToken(keyPair);
    expect(validateActivationKeyFormat(`  \n${token}\n `).isValid).toBe(true);
  });

  it("accepts a header without typ", () => {
    expect(validateActivationKeyFormat(fakeToken({ alg: "ES512" }, { a: 1 })).isValid).toBe(true);
  });

  it.each([
    ["empty string", "", "empty"],
    ["whitespace only", "   ", "empty"],
    ["one part", "abc", "structure"],
    ["two parts", "a.b", "structure"],
    ["four parts", "a.b.c.d", "structure"],
  ])("rejects %s", (_label, input, errorType) => {
    const result = validateActivationKeyFormat(input);
    expect(result.isValid).toBe(false);
    if (!result.isValid) expect(result.errorType).toBe(errorType);
  });

  it("pluralises the part count in the structure message", () => {
    const one = validateActivationKeyFormat("abc");
    const two = validateActivationKeyFormat("a.b");
    expect(!one.isValid && one.details).toContain("found 1 part.");
    expect(!two.isValid && two.details).toContain("found 2 parts.");
  });

  it("rejects an undecodable header", () => {
    const r = validateActivationKeyFormat("%%%.e30.c2ln");
    expect(r).toMatchObject({
      isValid: false,
      errorType: "header",
      message: "Invalid activation key header",
    });
  });

  it("rejects a header without alg", () => {
    const r = validateActivationKeyFormat(fakeToken({ typ: "JWT" }, {}));
    expect(r).toMatchObject({
      isValid: false,
      errorType: "header",
      message: "Missing algorithm in header",
    });
  });

  it("rejects a header with typ other than JWT", () => {
    const r = validateActivationKeyFormat(fakeToken({ alg: "ES512", typ: "JWE" }, {}));
    expect(r).toMatchObject({
      isValid: false,
      errorType: "header",
      message: "Invalid token type in header",
    });
    expect(!r.isValid && r.details).toContain('"JWE"');
  });

  it("rejects an undecodable payload", () => {
    const t = `${fakeToken(header, {}).split(".")[0]}.%%%.c2ln`;
    expect(validateActivationKeyFormat(t)).toMatchObject({ isValid: false, errorType: "payload" });
  });

  it("rejects a payload that is not JSON", () => {
    const b64 = (s: string) => btoa(s).replace(/=+$/, "");
    const t = `${fakeToken(header, {}).split(".")[0]}.${b64("not json")}.c2ln`;
    expect(validateActivationKeyFormat(t)).toMatchObject({ isValid: false, errorType: "payload" });
  });

  it("rejects a missing signature", () => {
    const [h, p] = fakeToken(header, {}).split(".");
    expect(validateActivationKeyFormat(`${h}.${p}.`)).toMatchObject({
      isValid: false,
      errorType: "structure",
      message: "Missing signature",
    });
  });

  it("reports jose parse failures as format errors", () => {
    // payload is valid JSON but not an object: jose.decodeJwt rejects it
    const r = validateActivationKeyFormat(fakeToken(header, [1, 2]));
    expect(r).toMatchObject({
      isValid: false,
      errorType: "format",
      message: "Failed to parse activation key",
    });
  });
});

describe("formatRelativeTime", () => {
  afterEach(() => vi.useRealTimers());

  it("handles null", () => {
    expect(formatRelativeTime(null)).toBe("Not specified");
  });

  it("formats past and future with suffixes", () => {
    vi.useFakeTimers({ now: new Date("2026-06-15T12:00:00Z") });
    expect(formatRelativeTime(new Date("2026-06-12T12:00:00Z"))).toBe("3 days ago");
    expect(formatRelativeTime(new Date("2026-06-18T12:00:00Z"))).toBe("in 3 days");
  });

  it("expiry mode: prefixes Expired for past, strict units for future", () => {
    vi.useFakeTimers({ now: new Date("2026-06-15T12:00:00Z") });
    expect(formatRelativeTime(new Date("2026-06-12T12:00:00Z"), true)).toBe("Expired 3 days ago");
    expect(formatRelativeTime(new Date("2026-06-18T12:00:00Z"), true)).toBe("in 3 days");
  });
});

describe("formatJwtDisplay", () => {
  it("keeps short tokens intact", () => {
    expect(formatJwtDisplay("short")).toBe("short");
    expect(formatJwtDisplay("x".repeat(20))).toBe("x".repeat(20));
  });
  it("elides long tokens to first/last 10 chars", () => {
    expect(formatJwtDisplay("0123456789-middle-ABCDEFGHIJ")).toBe("0123456789...ABCDEFGHIJ");
  });
});

describe("decodeJWT", () => {
  it("returns pretty-printed header and payload", async () => {
    const token = await signToken(keyPair, { sub: "abc", n: 1 });
    const out = JSON.parse(await decodeJWT(token));
    expect(out.header).toMatchObject({ alg: "ES512", typ: "JWT" });
    expect(out.payload).toMatchObject({ sub: "abc", n: 1 });
    expect(await decodeJWT(token)).toContain("\n  ");
  });
  it("returns {} for garbage", async () => {
    expect(await decodeJWT("garbage")).toBe("{}");
  });
});

describe("signJWT / validateJWTSignature round trip", () => {
  it("signs a token that verifies with the matching public key", async () => {
    const exp = new Date(Date.now() + 3600_000);
    const token = await signJWT({ sub: "u1", custom: { a: [1, 2] } }, "ES512", keyPair, exp);
    expect(token.split(".")).toHaveLength(3);
    const meta = getJwtMetadata(token);
    expect(meta?.algorithm).toBe("ES512");
    expect(meta?.expiresAt?.getTime()).toBe(Math.floor(exp.getTime() / 1000) * 1000);
    expect(JSON.parse(await decodeJWT(token)).payload).toMatchObject({
      sub: "u1",
      custom: { a: [1, 2] },
    });
    expect(await validateJWTSignature(token, keyPair)).toEqual({
      isValid: true,
      error: null,
      errors: undefined,
    });
  });

  it("fails verification against a different key", async () => {
    const token = await signJWT({}, "ES512", keyPair, new Date(Date.now() + 3600_000));
    const r = await validateJWTSignature(token, otherKeyPair);
    expect(r.isValid).toBe(false);
    expect(r.errors?.signature).toBe(true);
    expect(r.error).toBeTruthy();
  });

  it("reports an expired token as invalid", async () => {
    const token = await signJWT({}, "ES512", keyPair, new Date(Date.now() - 3600_000));
    const r = await validateJWTSignature(token, keyPair);
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/exp/i);
  });

  it("reports no key", async () => {
    const r = await validateJWTSignature("a.b.c", undefined);
    expect(r).toMatchObject({
      isValid: false,
      error: "No matching key found in your list of keys",
    });
  });

  it("reports tampered payloads", async () => {
    const token = await signJWT({ sub: "a" }, "ES512", keyPair, new Date(Date.now() + 3600_000));
    const [h, , s] = token.split(".");
    const forgedPayload = btoa(JSON.stringify({ sub: "evil" })).replace(/=+$/, "");
    expect((await validateJWTSignature(`${h}.${forgedPayload}.${s}`, keyPair)).isValid).toBe(false);
  });

  it("rejects signing without a private key", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(signJWT({}, "ES512", { ...keyPair, privateKey: "" }, new Date())).rejects.toThrow(
      "Private key is required",
    );
  });

  it("rejects SEC1 private keys with a conversion hint", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      signJWT({}, "ES512", { ...keyPair, privateKey: SEC1_PRIVATE_KEY }, new Date()),
    ).rejects.toThrow(/PKCS8/);
  });

  it("rejects malformed private keys", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      signJWT({}, "ES512", { ...keyPair, privateKey: "garbage" }, new Date()),
    ).rejects.toThrow();
  });
});

describe("generateEC512KeyPair", () => {
  it("produces PEM key pair usable for sign + verify", async () => {
    const generated = await generateEC512KeyPair();
    expect(generated.privateKey).toContain("-----BEGIN PRIVATE KEY-----");
    expect(generated.publicKey).toContain("-----BEGIN PUBLIC KEY-----");
    expect(generated.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(generated.createdAt).toString()).not.toBe("Invalid Date");
    const token = await signJWT({}, "ES512", generated, new Date(Date.now() + 60_000));
    expect((await validateJWTSignature(token, generated)).isValid).toBe(true);
  });

  it("generates distinct pairs", async () => {
    const [a, b] = await Promise.all([generateEC512KeyPair(), generateEC512KeyPair()]);
    expect(a.privateKey).not.toBe(b.privateKey);
    expect(a.id).not.toBe(b.id);
  });
});

describe("extractPublicKeyFromPrivate", () => {
  it("derives the matching SPKI public key", async () => {
    const derived = await extractPublicKeyFromPrivate(keyPair.privateKey);
    const token = await signJWT({}, "ES512", keyPair, new Date(Date.now() + 60_000));
    const key = await jose.importSPKI(derived, "ES512");
    await expect(jose.jwtVerify(token, key)).resolves.toBeTruthy();
  });
  it("throws on garbage", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(extractPublicKeyFromPrivate("nope")).rejects.toThrow();
  });
});
