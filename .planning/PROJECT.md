# SpeakLab — Hardening & Praticar Redesign

## What This Is

SpeakLab is an English learning app with scenario-based exercises, live AI roleplay, flashcards, and learning trails. Users practice through multiple modes (phrases, conversation, image-based exercises, live roleplay, trails) powered by AI (Gemini, OpenAI, Groq) with speech recognition and TTS. This milestone focuses on fixing critical architectural concerns and redesigning the Praticar (practice hub) page to match the visual quality of the rest of the app.

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
- ✓ Dev mode routing with mock auth (RELI-04) — Validated in Phase 01: dev-mode-routing
- ✓ Layered error boundaries with Portuguese fallback UI (RELI-01, RELI-02, RELI-03) — Validated in Phase 02: error-boundaries
- ✓ Code splitting with React.lazy + Suspense, chunk error soft retry (PERF-01, PERF-02, PERF-03) — Validated in Phase 03: code-splitting
- ✓ Secure API key storage with PBKDF2 encryption, proxy-only AI calls, client-side encryption removal (SEC-01, SEC-02, SEC-03, SEC-04) — Validated in Phase 04: secure-storage
- ✓ Consolidated dual storage layer into single facade with Supabase primary + localStorage fallback (STOR-01, STOR-02, STOR-03) — Validated in Phase 05: storage-consolidation
- ✓ Praticar page redesign with vertical image-banner cards, 2-section layout, full keyboard accessibility (VIS-01, VIS-02, VIS-03) — Validated in Phase 06: praticar-redesign

### Active

(All milestone requirements complete)

### Out of Scope

- Adding new exercise modes or features — focused on hardening existing functionality
- Full accessibility audit and remediation — too broad for this milestone
- Test suite expansion — addressed separately
- Backend/Supabase migration changes — client-side only

## Context

**Brownfield codebase** — React 19 SPA with Vite, Tailwind CSS, Supabase BaaS, Radix UI primitives. No external state management library; state lives in React Context (auth), singleton module (runtimeState), and localStorage.

**Key architectural issues (from codebase map):**
- ~~No error boundaries — any component crash whitescreens the entire app~~ ✓ Fixed in Phase 02
- ~~No code splitting — all 12 page components eagerly loaded including jspdf and motion~~ ✓ Fixed in Phase 03
- ~~API keys stored in localStorage plaintext alongside a Supabase encryption path with hardcoded fallback secret~~ ✓ Fixed in Phase 04
- ~~Dual storage layer (localStorage + Supabase) with duplicate function signatures creates import confusion~~ ✓ Fixed in Phase 05
- Sequential N+1 database writes in saveCards
- Dev mode routing bypasses Layout wrapper
- Error boundaries installed (app-level + route-level + chunk-load) — Portuguese fallback UI preserves sidebar navigation

**Praticar page:** Currently uses `ModeCard` — horizontal list-style cards with colored left border and small icon thumbnails. User wants it redesigned to use image-banner cards similar to `PathCard` (vertical cards with h-32 image on top, title, subtitle) but with different proportions to distinguish from the Trilhas page.

## Constraints

- **Tech Stack**: React 19, Vite, Tailwind CSS, Supabase — no new framework additions
- **Client-side only**: No Supabase migration or backend schema changes
- **Visual consistency**: Must use existing design tokens (CSS variables, Tailwind classes)
- **No breaking changes**: Existing routes, storage APIs, and component contracts must keep working

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Praticar cards inspired by PathCard with different proportions | User wants visual consistency with trilhas but not identical | — Pending |
| Encrypt API keys at rest instead of plaintext localStorage | Security concern flagged in codebase audit | — Pending |
| Lazy-load route components with React.lazy + Suspense | Code splitting without architecture overhaul | ✓ 48 chunks, jspdf isolated (Phase 03) |

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
*Last updated: 2026-04-02 after Phase 06 completion*
