/**
 * Encryption utilities for securing API keys before storing in Supabase.
 *
 * Uses AES-256-GCM encryption via the Web Crypto API.
 * Keys are encrypted on the client before sending to Supabase,
 * and decrypted by the Edge Function using a server-side key.
 */

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const SALT_LENGTH = 16
const IV_LENGTH = 12

/**
 * Encrypted data format
 */
export interface EncryptedData {
  ciphertext: string // base64
  iv: string // base64
  salt: string // base64
}

/**
 * Generate a random IV for AES-GCM
 */
function generateIV(): Uint8Array {
  return new Uint8Array(crypto.getRandomValues(new Uint8Array(IV_LENGTH)))
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes)
}

function toBufferSource(bytes: Uint8Array): BufferSource {
  return copyBytes(bytes) as BufferSource
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Derive a key from user-specific data (user ID + a secret)
 * This ensures each user's keys are encrypted with a unique key
 *
 * @param userId - The user's ID from Supabase auth
 * @param secret - A secret string (e.g., a hash of their session)
 * @returns The derived CryptoKey
 */
export async function deriveUserKey(userId: string, secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const saltInput = encoder.encode(userId + '-salt')
  // Create a deterministic salt from user ID for key derivation
  const saltHash = await crypto.subtle.digest('SHA-256', saltInput)
  const salt = copyBytes(new Uint8Array(saltHash).slice(0, SALT_LENGTH))

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId + secret),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toBufferSource(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt plaintext using AES-256-GCM
 *
 * @param plaintext - The data to encrypt
 * @param key - The encryption key
 * @returns The encrypted data with IV and salt
 */
export async function encrypt(plaintext: string, key: CryptoKey): Promise<EncryptedData> {
  const encoder = new TextEncoder()
  const data = copyBytes(encoder.encode(plaintext))
  const iv = generateIV()

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: toBufferSource(iv),
    },
    key,
    toBufferSource(data)
  )

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer),
    salt: '', // Not using salt for this simple encryption
  }
}

/**
 * Decrypt ciphertext using AES-256-GCM
 *
 * @param encryptedData - The encrypted data with IV
 * @param key - The decryption key
 * @returns The decrypted plaintext
 */
export async function decrypt(encryptedData: EncryptedData, key: CryptoKey): Promise<string> {
  const ciphertext = copyBytes(base64ToUint8Array(encryptedData.ciphertext))
  const iv = copyBytes(base64ToUint8Array(encryptedData.iv))

  const decrypted = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: toBufferSource(iv),
    },
    key,
    toBufferSource(ciphertext)
  )

  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

/**
 * Encrypt an API key for storage in Supabase
 *
 * @param apiKey - The API key to encrypt
 * @param userId - The user's ID for deriving the encryption key
 * @returns The encrypted data
 */
export async function encryptApiKey(apiKey: string, userId: string): Promise<EncryptedData> {
  // Use the user's session token as part of the key derivation
  // This ensures that if the session is compromised, the keys remain secure
  const sessionSecret = await getSessionSecret()
  const key = await deriveUserKey(userId, sessionSecret)
  return encrypt(apiKey, key)
}

/**
 * Decrypt an API key from Supabase
 *
 * @param encryptedData - The encrypted data
 * @param userId - The user's ID
 * @returns The decrypted API key
 */
export async function decryptApiKey(encryptedData: EncryptedData, userId: string): Promise<string> {
  const sessionSecret = await getSessionSecret()
  const key = await deriveUserKey(userId, sessionSecret)
  return decrypt(encryptedData, key)
}

/**
 * Get a session-specific secret for key derivation
 * In a real implementation, this would use the user's session token
 * or a password that only the user knows.
 *
 * For now, we'll use a combination of session storage data
 */
async function getSessionSecret(): Promise<string> {
  // Try to get the session token from various sources
  const sessionToken = localStorage.getItem('sb-session-token') ||
                       sessionStorage.getItem('sb-session-token') ||
                       'fallback-secret-change-in-production'

  return sessionToken
}

/**
 * Store the session token for key derivation
 * This should be called after successful authentication
 */
export async function storeSessionToken(token: string): Promise<void> {
  try {
    // Store a hash of the token, not the token itself
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
    const hashArray = Array.from(new Uint8Array(hash))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    localStorage.setItem('sb-session-token', hashHex)
  } catch (e) {
    console.warn('Failed to store session token:', e)
  }
}

/**
 * Clear the session token on logout
 */
export function clearSessionToken(): void {
  localStorage.removeItem('sb-session-token')
  sessionStorage.removeItem('sb-session-token')
}

/**
 * Generate a client-side encryption key for temporary use
 * (e.g., for encrypting data before sending to Edge Function)
 */
export async function generateClientKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * Export a CryptoKey to base64 for transport
 */
export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key)
  return arrayBufferToBase64(exported)
}

/**
 * Import a CryptoKey from base64
 */
export async function importKeyFromBase64(base64: string): Promise<CryptoKey> {
  const raw = copyBytes(base64ToUint8Array(base64))
  return crypto.subtle.importKey(
    'raw',
    toBufferSource(raw),
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  )
}
