export type Algorithm = string;

export const SUPPORTED_ALGORITHMS = ["ES512"];

/**
 * Metadata for activation key JWT tokens
 */
export interface ActivationKeyMetadata {
  algorithm: Algorithm | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
}

/**
 * Structure for public/private key pairs
 */
export interface KeyPair {
  id: string;
  name: string;
  privateKey: string;
  publicKey: string;
  createdAt: string;
}

/**
 * Result of verifying an activation key's signature against a key pair.
 */
export interface ValidationResult {
  isValid: boolean;
  error: string | null;
  keyName?: string;
  errors?: {
    expired?: boolean;
    signature?: boolean;
    message?: string;
  };
}
