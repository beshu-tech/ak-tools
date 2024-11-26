/**
 * Supported JWT signing algorithms
 */
export type Algorithm = string;

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