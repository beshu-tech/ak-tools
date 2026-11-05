import { describe, expect, it } from "vite-plus/test";
import { SEC1_PRIVATE_KEY } from "../test/fixtures";
import {
  getFirstError,
  hasValidationErrors,
  validateKeyPair,
  validateKeyPairName,
  validatePrivateKeyFormat,
  validatePublicKeyFormat,
} from "./validation";

const PRIV = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----";
const PUB = "-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----";

describe("validateKeyPairName", () => {
  it.each([
    ["", "Name is required"],
    ["   ", "Name is required"],
    ["a", "Name must be at least 2 characters"],
    [" a ", "Name must be at least 2 characters"],
    ["x".repeat(101), "Name must be less than 100 characters"],
  ])("rejects %j", (name, message) => expect(validateKeyPairName(name)).toBe(message));

  it.each(["ab", " ab ", "x".repeat(100), "My production key"])("accepts %j", (name) =>
    expect(validateKeyPairName(name)).toBeNull(),
  );
});

describe("validatePrivateKeyFormat", () => {
  it("requires a value", () =>
    expect(validatePrivateKeyFormat("  ")).toBe("Private key is required"));
  it("flags SEC1 with a conversion command", () => {
    const msg = validatePrivateKeyFormat(SEC1_PRIVATE_KEY);
    expect(msg).toContain("SEC1");
    expect(msg).toContain("openssl pkcs8 -topk8 -nocrypt");
  });
  it("flags non PKCS#8 text", () =>
    expect(validatePrivateKeyFormat("hello")).toMatch(/Invalid private key format/));
  it("accepts PKCS#8 with surrounding whitespace", () =>
    expect(validatePrivateKeyFormat(`\n ${PRIV} \n`)).toBeNull());
});

describe("validatePublicKeyFormat", () => {
  it("requires a value", () => expect(validatePublicKeyFormat("")).toBe("Public key is required"));
  it("flags non SPKI text", () =>
    expect(validatePublicKeyFormat("hello")).toMatch(/Invalid public key format/));
  it("flags a private key pasted as public", () =>
    expect(validatePublicKeyFormat(PRIV)).toMatch(/Invalid public key format/));
  it("accepts SPKI PEM", () => expect(validatePublicKeyFormat(PUB)).toBeNull());
});

describe("validateKeyPair", () => {
  it("returns no errors for a valid pair", () => {
    const errors = validateKeyPair({ name: "ok", publicKey: PUB, privateKey: PRIV });
    expect(errors).toEqual({});
    expect(hasValidationErrors(errors)).toBe(false);
    expect(getFirstError(errors)).toBeNull();
  });

  it("reports every invalid field for an empty object", () => {
    const errors = validateKeyPair({});
    expect(Object.keys(errors).sort()).toEqual(["name", "privateKey", "publicKey"]);
    expect(hasValidationErrors(errors)).toBe(true);
  });

  it("getFirstError follows field order name → publicKey → privateKey", () => {
    expect(getFirstError(validateKeyPair({}))).toBe("Name is required");
    expect(getFirstError(validateKeyPair({ name: "ok" }))).toBe("Public key is required");
    expect(getFirstError(validateKeyPair({ name: "ok", publicKey: PUB }))).toBe(
      "Private key is required",
    );
  });
});
