/** API key retrieval, storage, and source normalization */

import { decrypt } from './crypto.ts'
import { encrypt } from './crypto.ts'

/**
 * Map source name to DB column for API key retrieval.
 * Returns null for sources that don't use per-user API keys.
 */
export function sourceToDbColumn(source: string): string | null {
  if (source === 'genai') return 'gemini_key'
  if (source === 'openai') return 'openai_key'
  if (source === 'groq') return 'groq_key'
  if (source === 'openrouter') return 'openrouter_key'
  if (source === 'vertex') return null  // uses ADC, not per-user keys
  return null
}

/**
 * Normalize old provider values to new source names for backward compat.
 */
export function normalizeSource(source: string | undefined, fallback = 'genai'): string {
  if (!source) return fallback
  if (source === 'gemini') return 'genai'  // old client compat
  return source
}

/**
 * Get and decrypt a user's API key by source.
 * Supports both new source names and old provider names for backward compat.
 */
export async function getApiKey(supabase: any, encryptionKey: string, userId: string, source: string): Promise<string | null> {
  const dbColumn = sourceToDbColumn(source)

  // Vertex uses ADC, not per-user keys
  if (!dbColumn) return null

  const { data, error } = await supabase
    .from('encrypted_api_keys')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return null
  }

  const encryptedKey = data[dbColumn]

  if (!encryptedKey) {
    return null
  }

  try {
    const parsed = JSON.parse(encryptedKey)
    // New format: {ciphertext, iv, salt} — decrypt with PBKDF2
    if (parsed.ciphertext && parsed.iv && parsed.salt) {
      return await decrypt(parsed.ciphertext, parsed.iv, parsed.salt, encryptionKey)
    }
    // Old format: {ciphertext, iv} without salt — treat as plaintext (broken encryption)
    // Fall through to migration path below
  } catch {
    // Not JSON — it's plaintext, fall through to migration
  }

  // Plaintext key (or old client-side encrypted) — auto-migrate by re-encrypting server-side
  const plaintextValue = encryptedKey
  await saveApiKey(supabase, encryptionKey, userId, source, plaintextValue)
  return plaintextValue
}

/**
 * Save an encrypted API key — encrypts with PBKDF2 before storing.
 * Supports both new source names and old provider names for backward compat.
 */
export async function saveApiKey(supabase: any, encryptionKey: string, userId: string, source: string, key: string): Promise<void> {
  const encrypted = await encrypt(key, encryptionKey)
  const encryptedValue = JSON.stringify(encrypted)

  const { data: existing } = await supabase
    .from('encrypted_api_keys')
    .select('id')
    .eq('user_id', userId)
    .single()

  const dbColumn = sourceToDbColumn(source)
  if (!dbColumn) {
    throw new Error(`Cannot save key for source '${source}' — no DB column mapped`)
  }

  const updateData: Record<string, string> = {}
  updateData[dbColumn] = encryptedValue
  updateData[`${dbColumn}_updated_at`] = new Date().toISOString()

  if (existing) {
    await supabase
      .from('encrypted_api_keys')
      .update(updateData)
      .eq('id', existing.id)
  } else {
    await supabase
      .from('encrypted_api_keys')
      .insert({
        user_id: userId,
        ...updateData,
      })
  }
}
