# SpeakLab — Hardening & Praticar Redesign

## What This Is

SpeakLab is an English learning app with scenario-based exercises, live AI roleplay, flashcards, and learning trails. Users practice through multiple modes (phrases, conversation, image-based exercises, live roleplay, trails) powered by AI (Gemini, OpenAI, Groq) with speech recognition and TTS. The v1.0 milestone hardened the architecture (error boundaries, code splitting, secure storage, unified storage layer) and redesigned the Praticar page to match the visual quality of the rest of the app.

## Core Value

A reliable, polished practice experience — the app shouldn't crash, secrets shouldn't leak, and every page should feel cohesive.

## Requirements

### Validated

- ✓ Supabase authentication (Google/GitHub OAuth) — existing
- ✓ Multiple exercise modes (phrases, text, situation, image) — existing
- ✓ Live AI roleplay with Gemini/OpenAI realtime sessions — existing
- ✓ Learning trails with step-by-step scenarios and progress tracking — existing
- ✓ Flashcard spaced repetition review system — existing
- ✓ Gamification (XP, levels, streaks) — existing
- ✓ Error pattern analysis dashboard — existing
- ✓ Session history — existing
- ✓ Card library browser — existing
- ✓ Dark/light theme support — existing
- ✓ TTS and STT audio integration — existing
- ✓ User settings and API key management — existing
- ✓ Dev mode routing with mock auth (RELI-04) — v1.0 Phase 01
- ✓ Layered error boundaries with Portuguese fallback UI (RELI-01, RELI-02, RELI-03) — v1.0 Phase 02
- ✓ Code splitting with React.lazy + Suspense, chunk error soft retry (PERF-01, PERF-02, PERF-03) — v1.0 Phase 03
- ✓ Secure API key storage with PBKDF2 encryption, proxy-only AI calls, client-side encryption removal (SEC-01, SEC-02, SEC-03, SEC-04) — v1.0 Phase 04
- ✓ Consolidated dual storage layer into single facade with Supabase primary + localStorage fallback (STOR-01, STOR-02) — v1.0 Phase 05
- ✓ Praticar page redesign with vertical image-banner cards, 2-section layout, full keyboard accessibility (VIS-01, VIS-02, VIS-03) — v1.0 Phase 06

### Active

(None — awaiting v1.1 requirements definition)

### Out of Scope

- Adding new exercise modes or features — focused on hardening existing functionality
- Full accessibility audit and remediation — too broad for this milestone
- Test suite expansion — addressed separately
- Backend/Supabase migration changes — client-side only
- Offline sync queue (STOR-03) — deferred to future milestone
- Error tracking service integration (RELI-06) — deferred to future milestone

## Context

**Brownfield codebase** — React 19 SPA with Vite, Tailwind CSS, Supabase BaaS, Radix UI primitives. ~15,277 LOC TypeScript.

**v1.0 shipped with:**
- Error boundaries at app, route, and chunk-load levels with Portuguese fallback UI
- React.lazy code splitting with Suspense skeleton loading
- PBKDF2 encryption (600K iterations) for API keys with Edge Function proxy
- Unified storage facade replacing dual localStorage/Supabase imports
- Redesigned Praticar page with image-banner cards and 2-section layout

**Known technical debt:**
- Sequential N+1 database writes in saveCards
- Gemini Live WebSocket requires client-side API key (accepted risk)
- v2 requirements deferred (RELI-05/06, PERF-04/05, SEC-05, STOR-03/04, VIS-04/05)

## Constraints

- **Tech Stack**: React 19, Vite, Tailwind CSS, Supabase — no new framework additions
- **Client-side only**: No Supabase migration or backend schema changes
- **Visual consistency**: Must use existing design tokens (CSS variables, Tailwind classes)
- **No breaking changes**: Existing routes, storage APIs, and component contracts must keep working

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Encrypt API keys at rest with PBKDF2 | Security concern flagged in codebase audit | ✓ Good — keys never plaintext |
| Route all AI calls through Edge Function proxy | Eliminate client-side key exposure | ✓ Good — no direct provider calls |
| Lazy-load routes with React.lazy + Suspense | Code splitting without architecture overhaul | ✓ Good — 48 chunks, jspdf isolated |
| Single storage facade over dual imports | Eliminate import confusion between localStorage and Supabase | ✓ Good — 13 sites migrated |
| New PracticeModeCard vs modifying ModeCard | Safer — no risk to other ModeCard consumers | ✓ Good — clean separation |
| Dev mode mock user injection in AuthContext | Enables local testing of all hardening work | ✓ Good — full Layout accessible |
| Gemini Live WebSocket needs client-side API key | Technical constraint of the API | ⚠️ Accepted risk — needs documentation |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-07 after Phase 07 dead-code-facade-cleanup completion*
