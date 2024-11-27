import * as jose from 'jose';
import { formatDistanceToNow, formatDistanceToNowStrict } from 'date-fns';
import { ActivationKeyMetadata, KeyPair, Algorithm } from '../types/activationKey';
import { SignJWT } from 'jose';
import { generateKeyPair } from 'jose';


// Polyfill Buffer for browser environments
import { Buffer } from 'buffer';
const globalAny = typeof window !== 'undefined' ? window : global;
if (!globalAny.Buffer) {
  globalAny.Buffer = Buffer;
}

export const getJwtMetadata = (token: string): ActivationKeyMetadata | null => {
  try {
    const decoded = jose.decodeJwt(token);
    return {
      algorithm: jose.decodeProtectedHeader(token).alg ?? null,
      issuedAt: decoded.iat ? new Date(decoded.iat * 1000) : null,
      expiresAt: decoded.exp ? new Date(decoded.exp * 1000) : null,
    };
  } catch (e) {
    return null;
  }
};

export const formatRelativeTime = (date: Date | null, isExpiry = false): string => {
  if (!date) return 'Not specified';

  const now = new Date();
  const isPast = date < now;

  if (isExpiry) {
    return isPast
      ? `Expired ${formatDistanceToNow(date, { addSuffix: true })}`
      : `${formatDistanceToNowStrict(date, { addSuffix: true })}`;
  }

  return `${formatDistanceToNow(date, { addSuffix: true })}`;
};

export const formatJwtDisplay = (token: string): string => {
  if (token.length <= 20) return token;
  return `${token.slice(0, 10)}...${token.slice(-10)}`;
};

export const decodeJWT = async (token: string ): Promise<string> => {
  try {
    const decoded = jose.decodeJwt(token);
    const header = jose.decodeProtectedHeader(token);

    return JSON.stringify(
      {
        header,
        payload: decoded,
      },
      null,
      2
    );
  } catch (e) {
    return '{}';
  }
};

const checkPrivateKey = async (key: string): Promise<string> => {
  // Check if key is in SEC1 format
  if (key.includes('-----BEGIN EC PRIVATE KEY-----')) {
    throw new Error('Only PKCS8 format private keys are supported. Please convert your SEC1 key to PKCS8 format.');
  }
  return key;
};

export const signJWT = async (
  payload: any,
  algorithm: Algorithm,
  keyPair: KeyPair,
  expiryDate: Date
): Promise<string> => {
  try {
    if (!keyPair?.privateKey) {
      throw new Error('Private key is required');
    }
    // Normalize the private key format if needed
    const normalizedKey = await checkPrivateKey(keyPair.privateKey);
    // Get the correct curve for the algorithm
    const privateKey = await jose.importPKCS8(normalizedKey, 'ES512');

    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: algorithm })
      .setIssuedAt()
      .setExpirationTime(expiryDate)
      .sign(privateKey);

    return jwt;
  } catch (error) {
    console.error('Signing error:', error);
    throw error;
  }
};

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

export const validateJWTSignature = async (
  jwt: string, 
  keyPair: KeyPair | undefined
): Promise<ValidationResult> => {
  if (!keyPair) {
    return {
      isValid: false,
      error: 'No matching key found in your list of keys',
      errors: {
        signature: true,
        message: 'No matching key found in your list of keys'
      }
    };
  }

  try {
    const [header] = jwt.split('.');
    const decodedHeader = JSON.parse(atob(header));
    const algorithm = decodedHeader.alg;


    const normalizedKey = await checkPrivateKey(keyPair.publicKey);
    const publicKey = await jose.importSPKI(normalizedKey, algorithm);
    await jose.jwtVerify(jwt, publicKey);


    return {
      isValid: true,
      error: null,
      errors: undefined      
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errors: {
        signature: true,
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
};

export const generateEC512KeyPair = async (): Promise<KeyPair> => {
  try {
    const { privateKey, publicKey } = await generateKeyPair('ES512', {
      extractable: true  // Make sure keys are extractable
    });
    
    // Export keys in PKCS8 (private) and SPKI (public) formats
    const exportedPrivateKey = await jose.exportPKCS8(privateKey);
    const exportedPublicKey = await jose.exportSPKI(publicKey);
    
    return {
      id: crypto.randomUUID(),
      name: 'Generated ES512 Key Pair',
      privateKey: exportedPrivateKey,
      publicKey: exportedPublicKey,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Key pair generation error:', error);
    throw error;
  }
};

// Optional helper to extract public key from private key
export const extractPublicKeyFromPrivate = async (privateKeyString: string): Promise<string> => {
  try {
    const privateKey = await jose.importPKCS8(privateKeyString, 'ES512');
    const publicKey = await jose.exportSPKI(privateKey);
    return publicKey;
  } catch (error) {
    console.error('Public key extraction error:', error);
    throw error;
  }
};
