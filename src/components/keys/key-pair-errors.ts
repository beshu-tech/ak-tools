import type { KeyPair } from "../../types/activationKey";
import type { KeyPairValidationErrors } from "../../utils/validation";

export type KeyPairField = keyof KeyPairValidationErrors;
export const KEY_PAIR_FIELDS: KeyPairField[] = ["name", "publicKey", "privateKey"];

/** Drops the errors of the fields whose value differs between `prev` and `next`. */
export const clearChangedErrors = (
  errors: KeyPairValidationErrors,
  prev: Partial<KeyPair>,
  next: Partial<KeyPair>,
): KeyPairValidationErrors => {
  const result = { ...errors };
  for (const field of KEY_PAIR_FIELDS) if (prev[field] !== next[field]) delete result[field];
  return result;
};
