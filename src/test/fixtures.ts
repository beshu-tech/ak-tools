import * as jose from 'jose'
import type { KeyPair } from '../types/activationKey'

/** Real ES512 key pair in the formats the app stores (PKCS#8 / SPKI PEM). */
export async function makeKeyPair(name = 'Test key'): Promise<KeyPair> {
  const { privateKey, publicKey } = await jose.generateKeyPair('ES512', { extractable: true })
  return {
    id: crypto.randomUUID(),
    name,
    privateKey: await jose.exportPKCS8(privateKey),
    publicKey: await jose.exportSPKI(publicKey),
    createdAt: new Date().toISOString(),
  }
}

/** Sign a real ES512 activation key with `keyPair`. `exp` is epoch seconds. */
export async function signToken(
  keyPair: KeyPair,
  payload: jose.JWTPayload = { sub: 'tester' },
  { exp, iat }: { exp?: number; iat?: number } = {},
): Promise<string> {
  const key = await jose.importPKCS8(keyPair.privateKey, 'ES512')
  const jwt = new jose.SignJWT(payload).setProtectedHeader({ alg: 'ES512', typ: 'JWT' })
  jwt.setIssuedAt(iat)
  if (exp !== undefined) jwt.setExpirationTime(exp)
  return jwt.sign(key)
}

export const b64url = (value: string) =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Unsigned-looking token with arbitrary header/payload JSON, for format tests. */
export const fakeToken = (header: unknown, payload: unknown, signature = 'c2ln') =>
  `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}.${signature}`

export const SEC1_PRIVATE_KEY =
  '-----BEGIN EC PRIVATE KEY-----\nMIHcAgEBBEIB\n-----END EC PRIVATE KEY-----'

/** Seed the persisted collections the app reads from localStorage. */
export const seedKeyPairs = (pairs: KeyPair[]) =>
  localStorage.setItem('keyPairs', JSON.stringify(pairs))
export const seedTemplates = (templates: unknown[]) =>
  localStorage.setItem('akTemplates', JSON.stringify(templates))
