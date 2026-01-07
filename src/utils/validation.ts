import { KeyPair } from '../types/activationKey';

// Validation constants
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;

export interface KeyPairValidationErrors {
  name?: string;
  publicKey?: string;
  privateKey?: string;
}

/**
 * Validates private key format
 * Returns error message if invalid, null if valid
 */
export function validatePrivateKeyFormat(key: string): string | null {
  const trimmed = key.trim();

  if (!trimmed) {
    return 'Private key is required';
  }

  if (trimmed.includes('-----BEGIN EC PRIVATE KEY-----')) {
    return 'SEC1 private key format detected. Please convert to PKCS#8 format using:\nopenssl pkcs8 -topk8 -nocrypt -in sec1-key.pem -out pkcs8-key.pem';
  }

  if (!trimmed.includes('-----BEGIN PRIVATE KEY-----')) {
    return "Invalid private key format. Key must be in PKCS#8 PEM format (starting with '-----BEGIN PRIVATE KEY-----')";
  }

  return null;
}

/**
 * Validates public key format
 * Returns error message if invalid, null if valid
 */
export function validatePublicKeyFormat(key: string): string | null {
  const trimmed = key.trim();

  if (!trimmed) {
    return 'Public key is required';
  }

  if (!trimmed.includes('-----BEGIN PUBLIC KEY-----')) {
    return "Invalid public key format. Key must start with '-----BEGIN PUBLIC KEY-----'";
  }

  return null;
}

/**
 * Validates a key pair name
 * Returns error message if invalid, null if valid
 */
export function validateKeyPairName(name: string): string | null {
  const trimmed = name.trim();

  if (!trimmed) {
    return 'Name is required';
  }

  if (trimmed.length < MIN_NAME_LENGTH) {
    return `Name must be at least ${MIN_NAME_LENGTH} characters`;
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return `Name must be less than ${MAX_NAME_LENGTH} characters`;
  }

  return null;
}

/**
 * Validates an entire key pair object
 * Returns an object with field-specific errors, empty object if all valid
 */
export function validateKeyPair(keyPair: Partial<KeyPair>): KeyPairValidationErrors {
  const errors: KeyPairValidationErrors = {};

  const nameError = validateKeyPairName(keyPair.name ?? '');
  if (nameError) {
    errors.name = nameError;
  }

  const publicKeyError = validatePublicKeyFormat(keyPair.publicKey ?? '');
  if (publicKeyError) {
    errors.publicKey = publicKeyError;
  }

  const privateKeyError = validatePrivateKeyFormat(keyPair.privateKey ?? '');
  if (privateKeyError) {
    errors.privateKey = privateKeyError;
  }

  return errors;
}

/**
 * Check if validation errors object has any errors
 */
export function hasValidationErrors(errors: KeyPairValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Get first error message from validation errors (useful for simple alert display)
 */
export function getFirstError(errors: KeyPairValidationErrors): string | null {
  const firstKey = Object.keys(errors)[0] as keyof KeyPairValidationErrors | undefined;
  return firstKey ? errors[firstKey] ?? null : null;
}
