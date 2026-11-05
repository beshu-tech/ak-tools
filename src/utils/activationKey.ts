import * as jose from "jose";
import { formatDistanceToNow, formatDistanceToNowStrict } from "date-fns";
import {
  ActivationKeyMetadata,
  KeyPair,
  Algorithm,
  ValidationResult,
} from "../types/activationKey";

/** Epoch seconds as used by the JWT `iat` / `exp` claims. */
export const toEpochSeconds = (date: Date): number => Math.floor(date.getTime() / 1000);

const fromEpochSeconds = (seconds: number | undefined): Date | null =>
  seconds ? new Date(seconds * 1000) : null;

/** Reads algorithm, issue and expiry dates. Throws when `token` is not a decodable JWT. */
const readMetadata = (token: string): ActivationKeyMetadata => {
  const claims = jose.decodeJwt(token);
  return {
    algorithm: jose.decodeProtectedHeader(token).alg ?? null,
    issuedAt: fromEpochSeconds(claims.iat),
    expiresAt: fromEpochSeconds(claims.exp),
  };
};

export const getJwtMetadata = (token: string): ActivationKeyMetadata | null => {
  try {
    return readMetadata(token);
  } catch {
    return null;
  }
};

export interface AkValidationError {
  isValid: false;
  errorType: "empty" | "format" | "header" | "payload" | "structure";
  message: string;
  details?: string;
}

export interface AkValidationSuccess {
  isValid: true;
  metadata: ActivationKeyMetadata;
}

export type AkValidationResult = AkValidationError | AkValidationSuccess;

/**
 * Validates an activation key format with verbose error messages
 */
export const validateActivationKeyFormat = (token: string): AkValidationResult => {
  const trimmedToken = token.trim();

  // Check if empty
  if (!trimmedToken) {
    return {
      isValid: false,
      errorType: "empty",
      message: "Activation key is required",
      details: "Please paste a valid activation key in the input field.",
    };
  }

  // Check basic structure (should have 3 parts separated by dots)
  const parts = trimmedToken.split(".");
  if (parts.length !== 3) {
    return {
      isValid: false,
      errorType: "structure",
      message: "Invalid activation key structure",
      details: `Expected 3 parts separated by dots (header.payload.signature), but found ${parts.length} part${parts.length === 1 ? "" : "s"}. Make sure you copied the complete activation key.`,
    };
  }

  // Check if parts are valid base64url
  const [headerPart, payloadPart, signaturePart] = parts;

  // Validate header
  try {
    const headerJson = atob(headerPart.replace(/-/g, "+").replace(/_/g, "/"));
    const header = JSON.parse(headerJson);

    if (!header.alg) {
      return {
        isValid: false,
        errorType: "header",
        message: "Missing algorithm in header",
        details:
          'The activation key header is missing the "alg" (algorithm) field. This is required for signature verification.',
      };
    }

    // Validate typ if present - it should be 'JWT' or absent
    if (header.typ !== undefined && header.typ !== "JWT") {
      return {
        isValid: false,
        errorType: "header",
        message: "Invalid token type in header",
        details: `Expected type "JWT" but found "${header.typ}".`,
      };
    }
  } catch {
    return {
      isValid: false,
      errorType: "header",
      message: "Invalid activation key header",
      details:
        "The header section could not be decoded. It should be valid base64url-encoded JSON. The activation key may be corrupted or truncated.",
    };
  }

  // Validate payload
  try {
    const payloadJson = atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/"));
    JSON.parse(payloadJson);
  } catch {
    return {
      isValid: false,
      errorType: "payload",
      message: "Invalid activation key payload",
      details:
        "The payload section could not be decoded. It should be valid base64url-encoded JSON. The activation key may be corrupted or truncated.",
    };
  }

  // Validate signature exists (jose library handles detailed validation)
  if (!signaturePart) {
    return {
      isValid: false,
      errorType: "structure",
      message: "Missing signature",
      details:
        "The signature section is missing. Make sure you copied the complete activation key.",
    };
  }

  // If we get here, try to extract full metadata
  try {
    return { isValid: true, metadata: readMetadata(trimmedToken) };
  } catch (e) {
    return {
      isValid: false,
      errorType: "format",
      message: "Failed to parse activation key",
      details:
        e instanceof Error
          ? e.message
          : "An unexpected error occurred while parsing the activation key.",
    };
  }
};

export const formatRelativeTime = (date: Date | null, isExpiry = false): string => {
  if (!date) return "Not specified";

  const now = new Date();
  const isPast = date < now;

  if (isExpiry) {
    return isPast
      ? `Expired ${formatDistanceToNow(date, { addSuffix: true })}`
      : `${formatDistanceToNowStrict(date, { addSuffix: true })}`;
  }

  return `${formatDistanceToNow(date, { addSuffix: true })}`;
};

/** Pretty-printed JWT payload, or "{}" when `token` is not decodable. */
export const getPayloadJson = (token: string): string => {
  try {
    return JSON.stringify(jose.decodeJwt(token), null, 2);
  } catch {
    return "{}";
  }
};

const assertPkcs8 = (privateKey: string): void => {
  if (privateKey.includes("-----BEGIN EC PRIVATE KEY-----")) {
    throw new Error(
      "Only PKCS8 format private keys are supported. Please convert your SEC1 key to PKCS8 format.",
    );
  }
};

export const signJWT = async (
  payload: jose.JWTPayload,
  algorithm: Algorithm,
  keyPair: KeyPair,
  expiryDate: Date,
): Promise<string> => {
  try {
    if (!keyPair?.privateKey) {
      throw new Error("Private key is required");
    }
    assertPkcs8(keyPair.privateKey);
    const privateKey = await jose.importPKCS8(keyPair.privateKey, algorithm);

    const jwt = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: algorithm })
      // Honour an explicit iat (e.g. the Issued date picker); default to now.
      .setIssuedAt(payload.iat)
      .setExpirationTime(expiryDate)
      .sign(privateKey);

    return jwt;
  } catch (error) {
    console.error("Signing error:", error);
    throw error;
  }
};

export const validateJWTSignature = async (
  jwt: string,
  keyPair: KeyPair | undefined,
): Promise<ValidationResult> => {
  if (!keyPair) {
    return {
      isValid: false,
      error: "No matching key found in your list of keys",
      errors: {
        signature: true,
        message: "No matching key found in your list of keys",
      },
    };
  }

  try {
    const { alg } = jose.decodeProtectedHeader(jwt);
    const publicKey = await jose.importSPKI(keyPair.publicKey, alg ?? "");
    await jose.jwtVerify(jwt, publicKey);

    return {
      isValid: true,
      error: null,
      errors: undefined,
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : "Unknown error",
      errors: {
        signature: true,
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
};

export const generateEC512KeyPair = async (): Promise<KeyPair> => {
  try {
    const { privateKey, publicKey } = await jose.generateKeyPair("ES512", {
      extractable: true, // Make sure keys are extractable
    });

    // Export keys in PKCS8 (private) and SPKI (public) formats
    const exportedPrivateKey = await jose.exportPKCS8(privateKey);
    const exportedPublicKey = await jose.exportSPKI(publicKey);

    return {
      id: crypto.randomUUID(),
      name: "Generated ES512 Key Pair",
      privateKey: exportedPrivateKey,
      publicKey: exportedPublicKey,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Key pair generation error:", error);
    throw error;
  }
};

// Optional helper to extract public key from private key
export const extractPublicKeyFromPrivate = async (privateKeyString: string): Promise<string> => {
  try {
    const privateKey = await jose.importPKCS8(privateKeyString, "ES512", { extractable: true });
    // A private key cannot be exported as SPKI directly: drop the private part of its JWK first.
    const jwk = await jose.exportJWK(privateKey);
    delete jwk.d;
    return await jose.exportSPKI((await jose.importJWK(jwk, "ES512")) as CryptoKey);
  } catch (error) {
    console.error("Public key extraction error:", error);
    throw error;
  }
};
