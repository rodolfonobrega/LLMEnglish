# Phase 1: Dev Mode Routing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 1-dev-mode-routing
**Areas discussed:** Mock user fidelity, Backend fallbacks, Dev mode indicator

---

## Mock User Fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Full mock user | Fake name, avatar, gamification data — pages look realistic | ✓ |
| Minimal stub | Auth state says 'logged in' but minimal data — pages show empty/zero states | |
| Auth bypass only | Just skip auth check, don't mock any user data | |

**User's choice:** Full mock user
**Notes:** Pages should render realistically with populated data so developers can see how the app looks.

---

## Backend Fallbacks

| Option | Description | Selected |
|--------|-------------|----------|
| Graceful fallbacks | Show a friendly message when API calls fail, let user keep navigating | ✓ |
| Let them fail | Show error in console, let pages break naturally | |
| Silent mock data | Silently return empty/mock data so pages render something | |

**User's choice:** Graceful fallbacks
**Notes:** Don't crash pages — show friendly error and allow continued navigation.

---

## Dev Mode Indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Top banner | Subtle banner at top: 'Dev mode — some features unavailable' | ✓ |
| Header badge | Small badge in header corner | |
| No indicator | No visual indicator, just let pages work | |

**User's choice:** Top banner
**Notes:** Subtle but visible indicator so developers know they're not seeing production behavior.

---

## Claude's Discretion

- Exact mock user data values (name, avatar URL, XP numbers)
- Banner styling and exact text
- How to structure the mock auth provider (inline in App.tsx vs separate module)
