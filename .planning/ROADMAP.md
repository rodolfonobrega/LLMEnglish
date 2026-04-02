# Roadmap: SpeakLab — Hardening & Praticar Redesign

## Overview

This roadmap hardens SpeakLab's architecture and polishes the Praticar page. We start by fixing dev mode routing so all subsequent hardening work can be tested locally. Then we layer in error boundaries (crash isolation) followed by code splitting (performance). In parallel, we secure the encryption layer and consolidate the dual storage module. Finally, we redesign the Praticar page with image-banner cards and keyboard accessibility.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Dev Mode Routing** — Fix dev mode to render Layout + Routes with mock user, enabling local testing of all hardening work
- [ ] **Phase 2: Error Boundaries** — Install layered error boundaries so component crashes never whitescreen the app
- [ ] **Phase 3: Code Splitting** — Lazy-load all routes and extract heavy vendors from the initial bundle
- [ ] **Phase 4: Secure Storage** — Fix encryption parameters and route API calls server-side so keys are never exposed
- [ ] **Phase 5: Storage Consolidation** — Unify the dual storage layer behind a single facade to eliminate import confusion
- [ ] **Phase 6: Praticar Redesign** — Redesign practice hub with image-banner cards and keyboard accessibility

## Phase Details

### Phase 1: Dev Mode Routing
**Goal**: Developers can test all app features locally without a Supabase connection
**Depends on**: Nothing (first phase)
**Requirements**: RELI-04
**Success Criteria** (what must be TRUE):
  1. Running `npx vite` renders the same Layout + Routes structure as production
  2. Navigation sidebar and all page routes are accessible in dev mode
  3. Dev mode shows a mock authenticated user so auth-gated features render correctly
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md — Inject mock user in AuthContext, remove dev-mode bypass in ProtectedApp, create DevBanner, wire into Layout

### Phase 2: Error Boundaries
**Goal**: Any component crash shows a friendly error with retry instead of a whitescreen
**Depends on**: Phase 1
**Requirements**: RELI-01, RELI-02, RELI-03
**Success Criteria** (what must be TRUE):
  1. A crashed page shows a friendly error message with a retry button instead of a blank whitescreen
  2. User can navigate away from a broken page using the sidebar without losing the rest of the app
  3. When a lazy-loaded chunk fails to load, user sees an error with retry instead of a whitescreen
**Plans**: 1 plan

Plans:
- [x] 02-01-PLAN.md -- Install layered error boundaries (react-error-boundary + route errorElement + fallback components)

### Phase 3: Code Splitting
**Goal**: Users only download the code for the page they are viewing, with loading feedback
**Depends on**: Phase 2
**Requirements**: PERF-01, PERF-02, PERF-03
**Success Criteria** (what must be TRUE):
  1. Initial page load does not include jspdf or motion in the main bundle (verifiable via network tab or bundle analysis)
  2. User sees a loading indicator while navigating to a page for the first time
  3. Each route loads as a separate chunk that appears in the network tab only when that page is visited
**Plans**: 1 plan

Plans:
- [ ] 03-01-PLAN.md -- Convert all routes to React.lazy(), add Suspense + PageSkeleton in Layout, chunk error detection in ErrorFallback

### Phase 4: Secure Storage
**Goal**: User API keys are properly encrypted at rest and never sent directly to AI providers from the browser
**Depends on**: Phase 1
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. Examining localStorage reveals no plaintext API keys and no hardcoded fallback secret in source code
  2. Encryption uses PBKDF2 with 600K+ iterations and a unique random salt per user
  3. API key usage routes through a Supabase Edge Function proxy rather than making direct browser calls to AI providers
  4. Existing users' encrypted keys continue to work after the encryption parameter changes (migration path exists)
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md -- Add PBKDF2 encryption utilities to Edge Function, wire into saveApiKey/getApiKey with plaintext migration
- [ ] 04-02-PLAN.md -- Redirect openai.ts through aiProxy, gut client-side encryption, update SettingsPage dev mode

### Phase 5: Storage Consolidation
**Goal**: Developers import from a single storage module regardless of auth state, with no duplicate signatures
**Depends on**: Phase 4
**Requirements**: STOR-01, STOR-02
**Success Criteria** (what must be TRUE):
  1. All storage imports resolve to a single StorageAdapter facade module (no dual import paths remain)
  2. No two exported functions share the same name across the old storage files (rename complete, zero compile errors)
  3. All existing features that read or write data continue to work identically after consolidation
**Plans**: 1 plan

Plans:
- [ ] 05-01: TBD

### Phase 6: Praticar Redesign
**Goal**: The practice hub displays visually polished, keyboard-accessible image-banner cards
**Depends on**: Phase 5
**Requirements**: VIS-01, VIS-02, VIS-03
**Success Criteria** (what must be TRUE):
  1. Praticar page shows vertical cards with an image banner on top, title, and subtitle (inspired by PathCard layout)
  2. Praticar cards have visibly different proportions than Trilhas PathCards (distinct height, aspect ratio, or spacing)
  3. All practice mode cards are fully keyboard navigable (focusable, activatable with Enter/Space, ARIA-labeled)
**Plans**: 1 plan
**UI hint**: yes

Plans:
- [ ] 06-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6
Note: Phases 4-5 can run in parallel with phases 2-3 if desired (no code dependencies), but are numbered sequentially for clarity.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Dev Mode Routing | 0/1 | Planning complete | - |
| 2. Error Boundaries | 0/1 | Planning complete | - |
| 3. Code Splitting | 0/? | Not started | - |
| 4. Secure Storage | 0/2 | Planning complete | - |
| 5. Storage Consolidation | 0/? | Not started | - |
| 6. Praticar Redesign | 0/? | Not started | - |
