# Requirements: SpeakLab v1.4

**Defined:** 2026-04-18
**Core Value:** A reliable, polished practice experience — review should work, feedback should be useful, history should be visible.

## v1.4 Requirements

Requirements for milestone v1.4: Review, Analysis & Library.

### Review Algorithm (Bug Fixes)

- [ ] **REVI-01**: User can see new cards in the review queue immediately after saving them (fix createDefaultCard to set nextReviewAt + fix query to include NULLs)
- [ ] **REVI-02**: Existing orphaned cards (nextReviewAt=NULL) are automatically backfilled and become reviewable without manual intervention
- [ ] **REVI-03**: Partial knowledge scores (3-4 out of 10) map to "partial" quality tier, not "incorrect" — eliminates the punitive score cliff
- [ ] **REVI-04**: Same-day same-score reviews are preserved in history, not silently dropped by the dedup key

### Global Error Analysis (Teacher Reports)

- [ ] **ANAL-01**: User sees a teacher-style AI narrative report summarizing progress across sessions (e.g., "You struggle with past tense verbs", "Your articles are improving")
- [ ] **ANAL-02**: Error dashboard shows a visual report card with color-coded skill categories, trend indicators, and actionable recommendations
- [ ] **ANAL-03**: User can compare progress between periods (this week vs last week) with clear directional indicators

### Library History

- [ ] **LIBR-01**: User sees a score timeline chart per card showing how their scores changed over time
- [ ] **LIBR-02**: Card detail shows review statistics (total reviews, correct count, average score, current streak)
- [ ] **LIBR-03**: Card detail shows next review countdown (e.g., "Review again in 3 days", "Overdue by 2 days")

### Evaluation Trends

- [ ] **TREN-01**: User sees per-category trend direction and magnitude over time (e.g., "Grammar improved 20% this month, vocabulary declining")
- [ ] **TREN-02**: Trend visualization shows CSS-based trend lines per skill category (no chart library)
- [ ] **TREN-03**: Milestone markers celebrate progress (e.g., "You resolved your first article error!", "Verb tenses improving for 2 weeks straight")

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Audio History

- **AUDIO-01**: User can play back historical recordings from past review sessions (blocked by no-schema-change constraint — only latest recording stored)

### Advanced Analytics

- **ANALT-01**: Time-to-mastery prediction per skill category
- **ANALT-02**: Granular snapshot frequency at exercise completion (not just review sessions)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New exercise modes | This milestone fixes and enriches existing features |
| Backend/Supabase schema changes | Client-side only constraint |
| Chart libraries (recharts, chart.js) | Violates no-new-frameworks constraint; CSS bars sufficient |
| Historical audio playback | Only latest recording stored per card; requires schema change |
| Offline sync queue | Deferred from v1.0, still out of scope |
| Error tracking service integration | Deferred from v1.0, still out of scope |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| REVI-01 | — | Pending |
| REVI-02 | — | Pending |
| REVI-03 | — | Pending |
| REVI-04 | — | Pending |
| ANAL-01 | — | Pending |
| ANAL-02 | — | Pending |
| ANAL-03 | — | Pending |
| LIBR-01 | — | Pending |
| LIBR-02 | — | Pending |
| LIBR-03 | — | Pending |
| TREN-01 | — | Pending |
| TREN-02 | — | Pending |
| TREN-03 | — | Pending |

**Coverage:**
- v1.4 requirements: 13 total
- Mapped to phases: 0
- Unmapped: 13 ⚠️

---
*Requirements defined: 2026-04-18*
*Last updated: 2026-04-18 after milestone v1.4 kickoff*
