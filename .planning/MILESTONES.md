# Milestones

## v1.1 Dead Code & Facade Cleanup (Shipped: 2026-04-07)

**Phases completed:** 2 phases, 2 plans, 5 tasks

**Key accomplishments:**

- (none recorded)

---

## v1.0 Hardening & Praticar Redesign (Shipped: 2026-04-02)

**Phases completed:** 6 phases, 8 plans, 17 tasks

**Key accomplishments:**

- Mock authenticated user injection in AuthContext with DevBanner component, enabling full Layout + Routes access in dev mode without Supabase
- Layered React error boundaries with route-level errorElement, zero-dependency app fallback, and chunk-load recovery UI
- React.lazy() code splitting with Suspense skeleton fallback isolating jspdf into its own 395KB chunk
- PBKDF2 key derivation (600K iterations) with random salt and AES-256-GCM encryption for API keys in the Edge Function, plus transparent plaintext migration
- storage.ts rewritten as thin facade delegating sync reads to runtimeState cache and async queries to supabase/storage, with dev-mode fallback and 61 passing tests
- Migrated 13 consumer files from direct supabase/storage imports to the storage.ts facade, achieving single-import-path consistency across the entire codebase
- Vertical image-banner cards with h-40 banners, 2-section layout (Pratica Solo + Ao Vivo), full keyboard accessibility, and gradient+icon fallback -- replacing horizontal ModeCard list

---
