import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tests for `masterEnabled()` and the feature-flag plumbing.
 *
 * `MASTER_ENV_FLAG` is evaluated once at module load, so tests that need
 * different env values reset the module via `vi.resetModules()` after
 * stubbing `import.meta.env.VITE_MASTER_ENABLED`.
 */

async function freshModule() {
  vi.resetModules()
  return await import('./runtimeConfigSnapshot')
}

describe('masterEnabled (env flag)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('defaults to false when VITE_MASTER_ENABLED is unset', async () => {
    vi.stubEnv('VITE_MASTER_ENABLED', '')
    const mod = await freshModule()
    expect(mod.masterEnabled()).toBe(false)
  })

  it('returns true when VITE_MASTER_ENABLED is "true"', async () => {
    vi.stubEnv('VITE_MASTER_ENABLED', 'true')
    const mod = await freshModule()
    expect(mod.masterEnabled()).toBe(true)
  })

  it('returns true when VITE_MASTER_ENABLED is "1"', async () => {
    vi.stubEnv('VITE_MASTER_ENABLED', '1')
    const mod = await freshModule()
    expect(mod.masterEnabled()).toBe(true)
  })

  it('returns true when VITE_MASTER_ENABLED is "yes" (case-insensitive)', async () => {
    vi.stubEnv('VITE_MASTER_ENABLED', 'YES')
    const mod = await freshModule()
    expect(mod.masterEnabled()).toBe(true)
  })

  it('returns false when VITE_MASTER_ENABLED has any other value', async () => {
    vi.stubEnv('VITE_MASTER_ENABLED', 'maybe')
    const mod = await freshModule()
    expect(mod.masterEnabled()).toBe(false)
  })
})

describe('masterEnabled (per-user override)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('per-user override true wins even when env flag is false', async () => {
    vi.stubEnv('VITE_MASTER_ENABLED', '')
    const mod = await freshModule()
    expect(mod.masterEnabled()).toBe(false)

    mod.setMasterUserOverride(true)
    expect(mod.masterEnabled()).toBe(true)
  })

  it('per-user override false wins even when env flag is true', async () => {
    vi.stubEnv('VITE_MASTER_ENABLED', 'true')
    const mod = await freshModule()
    expect(mod.masterEnabled()).toBe(true)

    mod.setMasterUserOverride(false)
    expect(mod.masterEnabled()).toBe(false)
  })

  it('per-user override null falls back to env flag', async () => {
    vi.stubEnv('VITE_MASTER_ENABLED', 'true')
    const mod = await freshModule()

    mod.setMasterUserOverride(false)
    expect(mod.masterEnabled()).toBe(false)

    mod.setMasterUserOverride(null)
    expect(mod.masterEnabled()).toBe(true)
  })

  it('setMasterUserOverride notifies subscribers on change', async () => {
    vi.stubEnv('VITE_MASTER_ENABLED', '')
    const mod = await freshModule()
    const listener = vi.fn()
    const unsub = mod.subscribe(listener)

    mod.setMasterUserOverride(true)
    expect(listener).toHaveBeenCalledTimes(1)

    mod.setMasterUserOverride(true)
    expect(listener).toHaveBeenCalledTimes(1)

    mod.setMasterUserOverride(null)
    expect(listener).toHaveBeenCalledTimes(2)

    unsub()
  })

  it('snapshot.masterUserOverride defaults to null', async () => {
    const mod = await freshModule()
    expect(mod.getSnapshot().masterUserOverride).toBeNull()
  })

  it('resetSnapshot restores masterUserOverride to null', async () => {
    vi.stubEnv('VITE_MASTER_ENABLED', '')
    const mod = await freshModule()

    mod.setMasterUserOverride(true)
    expect(mod.getSnapshot().masterUserOverride).toBe(true)

    mod.resetSnapshot()
    expect(mod.getSnapshot().masterUserOverride).toBeNull()
  })
})
