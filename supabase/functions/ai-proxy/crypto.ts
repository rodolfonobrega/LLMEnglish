/** AES-256-GCM encryption with PBKDF2 key derivation */
import { uint8ToBase64 } from './utils.ts'

export const PBKDF2_ITERATIONS = 600_000
export const SALT_LENGTH = 16
export const IV_LENGTH = 12
export const KEY_LENGTH = 256

/**
 * Derive a cryptographic key from the encryption key and salt using PBKDF2
 */
export async function deriveKey(encryptionKey: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(encryptionKey),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Decrypt data using AES-256-GCM with PBKDF2-derived key
 */
export async function decrypt(ciphertext: string, iv: string, salt: string, key: string): Promise<string> {
  const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0))
  const cryptoKey = await deriveKey(key, saltBytes)
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0))
  const ciphertextBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    cryptoKey,
    ciphertextBytes
  )
  return new TextDecoder().decode(decrypted)
}

/**
 * Encrypt data using AES-256-GCM with PBKDF2-derived key and random salt
 */
export async function encrypt(plaintext: string, key: string): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const cryptoKey = await deriveKey(key, salt)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    new TextEncoder().encode(plaintext)
  )
  const ciphertextBytes = new Uint8Array(encrypted)
  return {
    ciphertext: uint8ToBase64(ciphertextBytes),
    iv: uint8ToBase64(iv),
    salt: uint8ToBase64(salt),
  }
}
