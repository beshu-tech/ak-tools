import { getPayloadJson, toEpochSeconds } from "./activationKey";

export type Payload = Record<string, unknown>;
export type DateClaim = "exp" | "iat";

/** Parses the editor text. Returns null unless it is a JSON object. */
export const parsePayload = (json: string): Payload | null => {
  try {
    const value: unknown = JSON.parse(json);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Payload) : null;
  } catch {
    return null;
  }
};

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([key, inner]) => [key, canonical(inner)]),
    );
  }
  return value;
};

/** Same claims, ignoring key order and formatting. */
export const samePayload = (a: Payload, b: Payload): boolean =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

export const claimDate = (payload: Payload, claim: DateClaim): Date | undefined => {
  const seconds = payload[claim];
  return typeof seconds === "number" ? new Date(seconds * 1000) : undefined;
};

/**
 * Sets `exp` or `iat` in the editor text to the picked day. The time of day of
 * the existing claim is kept. Returns null when the text is not a JSON object.
 */
export const withClaimDate = (json: string, claim: DateClaim, picked: Date): string | null => {
  const payload = parsePayload(json);
  if (!payload) return null;
  const next = new Date(picked);
  const previous = claimDate(payload, claim);
  if (previous) next.setHours(previous.getHours(), previous.getMinutes(), previous.getSeconds(), 0);
  payload[claim] = toEpochSeconds(next);
  return JSON.stringify(payload, null, 2);
};

export interface EditorDraft {
  /** The payload in the editor, or null when the text is not a JSON object. */
  payload: Payload | null;
  /** True when the editor differs from what the current key encodes. */
  hasEdits: boolean;
}

export const deriveDraft = (editorValue: string, jwt: string): EditorDraft => {
  const payload = parsePayload(editorValue);
  const signed = parsePayload(getPayloadJson(jwt));
  return { payload, hasEdits: !payload || !signed || !samePayload(payload, signed) };
};

export type SigningStatus = "invalid-json" | "no-key" | "edited" | "key-mismatch" | "up-to-date";

/** What the Generate button and the status line tell the user. */
export const signingStatus = (input: {
  draft: EditorDraft;
  hasSigningKey: boolean;
  signatureMismatch: boolean;
}): SigningStatus => {
  if (!input.draft.payload) return "invalid-json";
  if (!input.hasSigningKey) return "no-key";
  if (input.draft.hasEdits) return "edited";
  if (input.signatureMismatch) return "key-mismatch";
  return "up-to-date";
};

export const canGenerate = (status: SigningStatus) =>
  status === "edited" || status === "key-mismatch";
