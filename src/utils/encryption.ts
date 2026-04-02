/**
 * Session Token Storage
 *
 * Stores a hash of the session token in localStorage for session management.
 * All encryption/decryption is handled server-side by the Edge Function.
 */

/**
 * Store the session token (hashed) for session management
 */
export async function storeSessionToken(token: string): Promise<void> {
  try {
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
