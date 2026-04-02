# Requirements: SpeakLab — Hardening & Praticar Redesign

**Defined:** 2026-04-01
**Core Value:** A reliable, polished practice experience — no crashes, no leaks, cohesive design

## v1 Requirements

### Reliability

- [x] **RELI-01**: User sees a friendly error message instead of whitescreen when any page crashes (app-level error boundary)
- [x] **RELI-02**: User can navigate away from a broken page without losing the entire app (route-level error boundaries)
- [x] **RELI-03**: User sees a retry option when a page chunk fails to load (chunk-load error recovery)
- [x] **RELI-04**: Developer can test error boundaries and routing in dev mode (dev mode uses Layout wrapper)

### Performance

- [ ] **PERF-01**: User only downloads the code for the page they're viewing (lazy-loaded route components)
- [ ] **PERF-02**: User sees a loading indicator while a page chunk is being fetched (loading states)
- [ ] **PERF-03**: User's initial bundle excludes heavy dependencies like jspdf and motion (separate chunks)

### Security

- [x] **SEC-01**: API keys are not decryptable with a hardcoded fallback secret (remove hardcoded fallback)
- [x] **SEC-02**: Encryption uses OWASP-recommended PBKDF2 iterations (600K+)
- [x] **SEC-03**: Each user gets a unique random salt for encryption (not deterministic from userId)
- [ ] **SEC-04**: User's API keys are not sent directly to AI providers from the browser (server-side Edge Function proxy)

### Storage

- [x] **STOR-01**: Developer imports from a single storage module regardless of auth state (StorageAdapter facade)
- [x] **STOR-02**: Conflicting function signatures between localStorage and Supabase storage are renamed to prevent import confusion

### Visual

- [x] **VIS-01**: Praticar page displays practice modes as image-banner cards (inspired by PathCard)
- [x] **VIS-02**: Praticar cards use different proportions than Trilhas cards to maintain visual distinction
- [x] **VIS-03**: All Praticar cards are keyboard accessible (button elements, ARIA attributes)

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Reliability

- **RELI-05**: Error boundaries support reset-on-retry without full page reload
- **RELI-06**: Errors are reported to an external error tracking service

### Performance

- **PERF-04**: Navigation items preload their chunks on hover
- **PERF-05**: Bundle size is visualized and tracked in CI

### Security

- **SEC-05**: User can rotate API keys without losing encrypted data

### Storage

- **STOR-03**: App works offline with a sync queue that replays on reconnect
- **STOR-04**: Clear migration path from localStorage to Supabase-only storage

### Visual

- **VIS-04**: Praticar cards animate on entrance and hover
- **VIS-05**: Each practice mode category has distinct color theming

## Out of Scope

| Feature | Reason |
|---------|--------|
| New exercise modes | This milestone focuses on hardening existing features |
| Full accessibility audit | Too broad; only Praticar accessibility addressed here |
| Test suite expansion | Addressed separately |
| Supabase schema changes | Client-side only changes in this milestone |
| Backend infrastructure changes | No new servers, databases, or services |
| Mobile app | Web-only for this milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RELI-01 | Phase 2 | Complete |
| RELI-02 | Phase 2 | Complete |
| RELI-03 | Phase 2 | Complete |
| RELI-04 | Phase 1 | Complete |
| PERF-01 | Phase 3 | Pending |
| PERF-02 | Phase 3 | Pending |
| PERF-03 | Phase 3 | Pending |
| SEC-01 | Phase 4 | Complete |
| SEC-02 | Phase 4 | Complete |
| SEC-03 | Phase 4 | Complete |
| SEC-04 | Phase 4 | Pending |
| STOR-01 | Phase 5 | Complete |
| STOR-02 | Phase 5 | Complete |
| VIS-01 | Phase 6 | Complete |
| VIS-02 | Phase 6 | Complete |
| VIS-03 | Phase 6 | Complete |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 after roadmap creation*
