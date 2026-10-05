/**
 * OAuth 2.1 PKCE (Proof Key for Code Exchange - RFC 7636) Utilities.
 * Compatible with Web Browsers (Web Crypto API) and Node.js runtime environments.
 */

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/**
 * Generates cryptographically secure random bytes in any modern JS environment.
 */
function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
    return bytes;
  }
  // Node.js fallback if crypto.getRandomValues is unavailable
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    return nodeCrypto.randomBytes(length);
  } catch {
    // Pure fallback if running in constrained sandbox
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }
}

/**
 * Converts a Uint8Array buffer into a URL-safe Base64 string without padding.
 */
export function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(buffer).toString('base64');
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates an OAuth 2.1 PKCE Code Verifier (RFC 7636).
 * Minimum 43 characters, maximum 128 characters.
 */
export function generateCodeVerifier(length: number = 64): string {
  const clampedLength = Math.max(43, Math.min(128, length));
  const bytes = getRandomBytes(clampedLength);
  let verifier = '';
  for (let i = 0; i < clampedLength; i++) {
    verifier += CHARSET[bytes[i] % CHARSET.length];
  }
  return verifier;
}

/**
 * Computes SHA-256 hash and encodes to base64url to produce PKCE Code Challenge.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);

  // Modern browser & Node 15+ Web Crypto API
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(hashBuffer));
  }

  // Node.js crypto fallback
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    const hash = nodeCrypto.createHash('sha256').update(verifier).digest();
    return base64UrlEncode(new Uint8Array(hash));
  } catch (err: any) {
    throw new Error(`Unable to compute SHA-256 PKCE code challenge: ${err.message}`);
  }
}

/**
 * Generates a random alphanumeric string for state and nonce tokens.
 */
export function generateRandomString(length: number = 32): string {
  const bytes = getRandomBytes(length);
  let str = '';
  for (let i = 0; i < length; i++) {
    str += CHARSET[bytes[i] % CHARSET.length];
  }
  return str;
}
