# Master Integration Plan — Making the Tutor Omnipresent

**Status:** proposal, not yet executed.
**Author:** written 2026-04-20 after a full-app surface audit, revised
the same day per product feedback.
**Scope:** turn the Master from "integrated in 3 surfaces" into the
**pedagogical backbone of the entire `/practice` hub and every
production-bearing surface**, without sacrificing student autonomy or
breaking existing flows.

**Development-stage note (important):** the app is still 100% in
development — **no real users yet**. Backward-compatibility is not a
requirement. Anything we don't use, or that the Master replaces, can
be freely changed or removed. This plan treats every existing surface
as editable.

---

## 0. TL;DR

Today the Master evaluates/updates the learner model in **3 of 17
surfaces**. The other 14 surfaces either discard the signal (live
conversations, visual, focused drills, review) or never produce a
signal (library, history, scripts, paths). The app's mission is
*"ajudar o aluno a aprender a falar"*, and the Master is the one
component that can personalize that help over time. Shipping it on
only 3 surfaces — and leaving Live, the **primary speaking surface**,
entirely outside the Master — is the central bug this plan fixes.

**The anchoring commitment, layered on top of the phases below:**
**Live is the final exam.** A pattern is mastered only when the
student has produced it correctly in conversation, across multiple
Live sessions, **across multiple themes**, over time. Two great
Lives in the same job-interview scenario don't count — that's
topic rehearsal. Real fluency means carrying the pattern across
different kinds of conversations. Drills, cards, and lessons exist
to prepare for Live, not to substitute for it. See §1.2 and §1.3.

This plan delivers that in **nine phases**, prioritized by **signal
density × implementation cost × pedagogical impact**:

| Phase | Fixes | What the student notices |
| ----- | ----- | ------------------------ |
| 1 — Plumbing fixes | Briefing propagation to drills + Visual; `masterEvaluate` on surfaces that already produce a 5D evaluation | **Nothing visible.** Better prescriptions within ~5 sessions. |
| 2 — Live & Paths (the final exam) | Post-conversation Master evaluation on `/live` and `/paths`; mini-live (3–4 turns, ~2 min) as the default prescription; `live_fluency_profile` on the LearnerModel; scenario generation from Master briefings | Still mostly invisible. Shorter default sessions. The highest-signal surface of the app finally feeds the tutor, and the **mother metric** (fluency over weeks) becomes measurable. |
| 3 — Reflection surfaces | Review-session recap, History with MetaAssessment, Error Dashboard with Master overlay | A gentle **"reflexão" card after long sessions** — stealth pedagogy, opt-in explanation. Reflections lead with observations about speaking, not grammar. |
| 4 — Always-on automaticity drills | Auto-generate FeedbackDrill & Oral Cloze from `hard_for_user` during idle moments, Scripts page pulls from LearnerModel | Idle-time prompts to reinforce weak spots without derailing the main flow. |
| 5 — Per-role Master model configuration | Each Master role (prescribe / evaluate / update_model / compose_lesson / render_moment + new live / summarize_session) gets its own model/source in Settings | Dev-only UI for now — lets us tune cost vs. quality per role. |
| ~~6 — Prompt optimization harness~~ *(dropped as a phase)* | Replaced with a **lightweight prompt iteration methodology** (see §7b): every time a Master prompt changes, iterate it externally against Vertex in a throwaway Python script, then paste the final string into `src/services/master/*.ts`. No in-repo harness, no fixtures, no `npm run prompt-lab`. | No user-visible change. |
| 7 — Deep progression & mastery calibration (Live-anchored) | Multi-dimensional promotion gate with a **non-negotiable Live requirement** (≥ 2 correct live turns across ≥ 2 sessions across ≥ 2 themes, separated by ≥ 72 h), evidence tracking (themes, modalities, sessions, Live counters, Live themes), trajectory, theme-diverse and Live-biased re-exposure checks, ladder memory | Promotion becomes honest: "mastered" means the student can actually do it in conversation, across **multiple topics**, across days — never a lucky drill streak, never a single-scenario grind. Progress may slow, and that's the point: **no hurry to advance**. |
| 8 — Intent handshake | `SessionIntent` structure; student can pin theme / word / modality / card for a session, and the Master **weaves** its target pattern inside the student's request | Student finally feels heard: "I want to practice viagens" is respected, with the Master's priorities threaded in invisibly. |
| 9 — Review card variation | Review cards return as **variants** (same pattern, different theme/verbs) using `varyCard`; pattern-level review sessions | Reviews stop feeling like grinding and start feeling like genuine re-exposure. |

**Guiding principle:** the Master *listens everywhere, speaks only where
explicitly allowed.* Today it speaks only inside Lessons and (subtly) via
Practice Sugerida. Reflection surfaces in Phase 3 are the first time it
speaks outside a lesson, and they remain opt-in.

**Coverage principle (revised):** the Master MUST have visibility into
100% of what lives under `/practice`, and Live is its **primary**
observation post, not "one surface among many". Every solo exercise,
every live surface, every focused drill, and every review must either
feed the LearnerModel or carry a file-level comment explaining the
deliberate exception. No silent holes — see §2.4.

**Pace principle:** there is **no promotion deadline**. If a pattern
has drilled evidence but no Live evidence across days, it stays
`acquiring`. The plan is calibrated to *truth*, not *throughput*.

---

## 1. App mission and the Master's role in it

The app's core promise to the student is **"fluent conversational English,
through deliberate practice, adapted to where you are right now."** Every
surface exists to serve one of these three verbs:

1. **Generate** contextualized material (phrase, scenario, image, path).
2. **Elicit** a student production (typed, spoken, roleplayed).
3. **Evaluate** the production and give feedback.

The Master's job is to be the **memory across all three verbs** so that
tomorrow's generation, elicitation, and evaluation are **calibrated by
today's behaviour** — not random, and not uniformly drilled.

A surface that doesn't feed the Master is a surface where the student's
effort is **discarded for learning purposes**. The student still gets XP
and a card, but the tutor stays ignorant of what just happened. That's
the bug.

### 1.1 The Master is a personal trainer, not a grader

This is the product definition the plan is graded against. Every phase
below exists in service of these commitments:

1. **Speaking is the goal; everything else is scaffolding.** The
   app's differentiator is "falar, falar, falar". Isolated exercises,
   drills, cards, and review exist to build pieces that the student
   assembles in a live conversation. The Master's north star is not
   "did the student answer correctly" but "is the student
   **speaking more, more easily, more accurately**, over time". See
   §1.2 for why Live is elevated from "a surface" to "the final
   exam".

2. **Deep evidence, never shallow.** The Master must NEVER decide
   "mastered / advance / struggling" based on 2–3 utterances.
   Promotion requires **variety of context**, **consistency across
   sessions**, and **re-exposure with variation** (see Phase 7). A
   student who gets 5 identical drills right has practised
   repetition, not demonstrated mastery.

3. **No hurry to advance.** Promotion is calibrated to reflect real
   learning, never to reward engagement or keep the progress bar
   moving. A student who stays at the same rung for weeks because
   the evidence isn't there yet is a student being **served**, not
   stalled. The enemy is false mastery, not slow mastery.

4. **Continuous observation + action.** The Master is watching **100%
   of what happens under `/practice`** — including review, live,
   drills, scripts — and it takes action based on that observation
   (see §2.4). If the student is producing something, the Master is
   building evidence.

5. **Progress-aware, not snapshot-aware.** The Master's job is not
   "where is the student today?" It's "is the student **evolving**?"
   Two students with the same CEFR estimate but different trajectory
   (one plateauing, one climbing) must get different prescriptions.
   Trajectory is tracked in the LearnerModel alongside state (see
   Phase 7).

6. **Ladder-aware.** When a pattern is mastered, the Master doesn't
   just celebrate — it **already knows the next rung**. Every
   `mastered.add` patch should coincide with a new
   `next_step_plan.primary_goal` that represents the next deliberate
   stretch. Promotion is always paired with a next target.

7. **The student can steer.** The student can say "quero praticar
   passado hoje" or "quero revisar a palavra X" or "só oral cloze
   pelos próximos dias". The Master must honour that request **and
   weave its own priorities into it** (pick a theme from
   `themes_that_land`, a difficulty from the current level, a
   disguise that exercises a `chronic_error` inside the student's
   request). Student intent and Master intent are **negotiated**,
   not winner-takes-all (see Phase 8).

8. **Comfortable, never chatty.** The Master is invisible until it
   speaks, and when it speaks, it's useful, brief, and warm. It never
   lectures, never shames, never explains grammar unprompted. A good
   Master interaction feels like a coach noticing something, not a
   teacher correcting you. A student must be able to use the app for
   a whole session without hearing from the Master and not feel
   abandoned.

9. **Familiar-but-different, not identical.** When the Master surfaces
   a review or a re-exposure, the content should feel **related to
   something the student saw before** but **varied enough to test
   transfer**, not memory. A card the student saw yesterday can come
   back tomorrow with the same target pattern in a different scene,
   different verb, different theme (see Phase 9).

These nine commitments are the commitments of a personal trainer for
spoken English. If a phase below doesn't serve at least one of them,
it shouldn't ship.

### 1.2 Live is the final exam (and it's more than one exam)

The app's differentiator is speaking. Every other surface — phrases,
texts, drills, review cards — is **scaffolding** the student
assembles into the real thing: sustaining a conversation in English.
A pattern that works in 5 phrase exercises but collapses on turn 3
of a live roleplay is **not learned** — it was rehearsed. The Master
must not be fooled by rehearsal — and "rehearsal" includes
rehearsing *the same scene* over and over in Live.

Consequences that permeate the rest of this plan:

1. **Live is the realness check for every pattern.** No pattern may
   be promoted to `mastered` without at least **2 distinct
   successful Live turns in at least 2 distinct Live sessions across
   at least 2 distinct themes** using that pattern (see Phase 7's
   `live_confirmed` gate). A pattern the student has only ever
   produced in drills is, by definition, not mastered. A pattern the
   student has produced only in the same scenario twice is also not
   mastered — that's rehearsal wearing a Live costume.

2. **One live isn't enough; consistency across time AND themes is.**
   "Did the student sustain the pattern in live today?" is a poor
   signal on its own, and so is "Did the student sustain the pattern
   in live twice in a row?" if both times were the same job-interview
   scenario. The real question is: **"Has the student sustained the
   pattern in live across a window of days, with real variation in
   theme and scenario?"** Phase 7 encodes this: Live evidence must
   accumulate across sessions separated in time **and** across at
   least two distinct themes. A pattern never tested outside one
   theme is a pattern that hasn't transferred.

3. **Live is default, isolated practice is support.** `prescribe`
   prefers a short Live exposure by default, and reaches for
   isolated exercises (phrase / drill / cloze) only when the student
   is still building the vocabulary/scaffolding needed to use the
   pattern in conversation. See §1.3 below. The Master sends the
   student to a drill because they **need** one, not because a drill
   is the safer default.

4. **Live is where fluency itself is measured.** The LearnerModel
   carries a `live_fluency_profile` that captures how the student
   actually speaks: average turn length, response latency,
   abandoned-turn rate, complexity trajectory. These are the real
   outcome variables the app exists to move. Everything else
   (patterns mastered, chronic errors, CEFR estimate) is an
   intermediate variable in service of `live_fluency_profile`
   improving over weeks.

5. **Reflection speaks about speaking.** Phase 3's reflection cards
   and Phase 4's nudges lead with observations about **how the
   student is talking**, not about which grammar point they nailed.
   "Suas histórias estão ficando mais longas" beats "você dominou
   o past continuous". Both can be true, but only the first is the
   outcome the student came here for.

### 1.3 When to pull the student into Live, when to hold them back

`prescribe`'s default mode is **live-first**. It steps away from
live only under these four conditions:

1. **Vocabulary gap.** The current target pattern requires words or
   phrases the LearnerModel shows the student doesn't have yet.
   Prescribe an isolated exposure (phrase / text) that introduces
   those words in context first; then a live follow-up when they're
   in place.
2. **Cold introduction of a new pattern.** The first exposure to a
   previously unseen canonical pattern goes through an isolated
   noticing surface (phrase, cloze, or Lesson moment 2) before a
   live attempt. Skipping this introduces the pattern under stress,
   which risks entrenching the wrong form.
3. **Student intent pins a non-live modality.** `SessionIntent.
   requested_modality = 'cloze'` (etc.) is respected verbatim (see
   Phase 8).
4. **"Quick practice" mode.** Live sessions are never sub-2-minute;
   quick practice bypasses live entirely.

Otherwise: the Master picks a **short live exposure** (mini-live,
~3–4 turns, ~2 minutes, see Phase 2) that creates the opportunity to
produce the target pattern in conversation. The Master accepts that
the student will sometimes be underprepared and that the session
will sometimes produce corrections. That's the point. The student
learns to speak by speaking.

---

## 2. Current state — what the Master sees vs what it misses

Based on `explore` audit (2026-04-20):

### 2.1 Master-aware (today)

| Surface | Briefing in? | LearnerModel out? | Notes |
| ------- | ------------ | ----------------- | ----- |
| `/exercises?mode=phrases\|texts\|situations` **when launched via Prática Sugerida** | Yes | Yes (async `masterEvaluate` + `updateLearnerModel`) | Only with `location.state.briefing`. |
| `/practice` (Prática Sugerida button) | N/A | N/A | Calls `prescribe`, then routes. |
| `/lesson/:lessonId` | N/A (plan already fixed at create) | Yes (`lessonBoost`) | Full stack. |

### 2.2 Master-blind (today) — these are our targets

| Surface | Student effort | What the Master misses |
| ------- | -------------- | ---------------------- |
| `/live` (Live Roleplay) | Multi-turn **spoken** conversation | The richest signal in the whole app — discarded. |
| `/paths` (Trilhas) | Same as live, structured into trail steps | Same as live; plus step-completion signal. |
| `/exercises?mode=visual` (Desafio Visual) | Spoken scene description | 5D evaluation exists but never goes to LearnerModel. |
| `/exercises?mode=cloze\|...` (7 drills) | Spoken/recorded drill answer | Even when launched via Prática Sugerida, `ExercisesPage` never reads `location.state.briefing`. |
| `/review` | Spoken review card | Full `EvaluationResult` + `canonical_pattern` produced and thrown away. |
| `/scripts` | Typed situation | No evaluation at all today — could at least record intent. |
| `/history` | Browse past sessions | No opportunity to review reflective insights. |
| `/errors` | Browse error dashboard | No tie-in with LearnerModel priorities. |
| `/library` | Manage cards | No reflection on which cards the Master would prioritize. |

### 2.3 Critical plumbing bug

`routeModality()` **already routes** Prática Sugerida → focused drill with
`state.briefing`, but **`ExercisesPage.tsx` never reads
`useLocation().state`** before rendering the drill component. So briefings
are silently dropped for all 7 drills + Visual. **This is a one-hour fix
with outsized impact** and it's Phase 1 item #1.

### 2.4 Full `/practice` coverage matrix

Per product decision, the Master MUST observe 100% of `/practice` and
every production-bearing surface. **Live surfaces (`simulation`,
`trails`, and the new `mini-live`) are the primary observation
posts** — they're what mastery gates read from in Phase 7 and what
the mother metric tracks in §11.1. Everything else is support.

This is the authoritative checklist the implementation is graded
against:

| Surface | Category | Signal type | Target state after this plan | Phase |
| ------- | -------- | ----------- | ----------------------------- | ----- |
| `simulation` (Live Roleplay) | **live (primary)** | multi-turn spoken conversation | post-conversation Master evaluation with per-turn `turns_correct[]` / `turns_incorrect[]` lists → LearnerModel (including Live counters) + `live_fluency_profile` data point | **P2** |
| `mini-live` (new, default Prática Sugerida modality) | **live (primary)** | 3–4-turn spoken exchange, ~2 min | same as simulation, tagged `session_size: 'mini'` | **P2** |
| `trails` (Paths) | **live (primary)** | multi-turn spoken conversation inside a path step | same as simulation + step pedagogical intent | **P2** |
| `phrases` | solo (support) | typed/spoken utterance + 5D eval | briefing in, MetaAssessment out, LearnerModel update | P1 (exists, verify) |
| `texts` | solo (support) | typed/spoken paragraph + 5D eval | same as above | P1 (exists, verify) |
| `situations` (roleplay) | solo (support) | typed/spoken roleplay + 5D eval | same as above | P1 (exists, verify) |
| `visual` | solo (support) | spoken scene description + 5D eval | briefing in, MetaAssessment out | P1.2 |
| `scripts` | solo (support) | typed situation description | **read-only for Master** until we add eval; at minimum record intent+theme as engagement signal | P1.4 (new — see §4.5) |
| `cloze` (Oral Cloze) | drill (support) | per-round audio answer | briefing in, `recordDrillOutcome` out | P1.1 + P1.3 |
| `spotting` (Error Spotting) | drill (support) | per-round choice | briefing in, `recordDrillOutcome` out | P1.1 + P1.3 |
| `reaction` (Reaction Drill) | drill (support) | per-round spoken reaction | briefing in, `recordDrillOutcome` out | P1.1 + P1.3 |
| `shadowing` (Active Shadowing) | drill (support) | per-round shadowed audio | briefing in, `recordDrillOutcome` out | P1.1 + P1.3 |
| `reformulation` | drill (support) | rewritten utterance + 5D eval | briefing in, MetaAssessment out | P1.2 |
| `narrative` (Narrative Continuation) | drill (support) | continued narrative + 5D eval | briefing in, MetaAssessment out | P1.2 |
| `listening` (Directed Listening) | drill (support) | typed answer to listened passage + 5D-like eval | briefing in, MetaAssessment out | P1.2 |
| `review` (SRS cards) | review (support) | spoken review card + 5D eval | briefing in (from queue prioritization), MetaAssessment out | P1.2 |
| `history` (page) | reflection | read-only browse | Master annotations on past sessions | P3 |
| `errors` (Error Dashboard) | reflection | read-only browse | Master overlay (priority ordering, hypothesis tooltips) | P3 |
| `library` | reflection | read-only browse | "Hoje o tutor recomenda" section from `chronic_errors` | P4 |

**"Primary" vs "support" is a pedagogical label, not a volume label.**
A student will likely still spend more total minutes in drills than
in Live during any given week. The label just says: a drill outcome
is *evidence in service of* a future Live success; a Live outcome is
*evidence of the thing itself*.

**Status legend after all phases ship:**
- **Eval-producing surfaces** (11 of 14): briefing injected if present, `masterEvaluate` + `updateLearnerModel` always called.
- **Signal-only surfaces** (2 of 14 — scripts, drills without 5D): lightweight `recordDrillOutcome` path, no MetaAssessment.
- **Reflection surfaces** (3): Master writes, never reads student production.

**No exceptions silently.** Any surface that cannot feed the Master
(e.g. scripts pre-eval) MUST have a `// MASTER-EXEMPT:` comment in the
file explaining why. A lint rule (§4.5) enforces this.

---

## 3. Design principles (so we don't break the app while fixing it)

1. **Listen everywhere, speak in designated places.** New Master
   integrations in Phases 1–2 are **background-only**: async, fire-and-
   forget `updateLearnerModel`. They *never* change UX copy, latency, or
   error state on the student's main flow.

2. **Existing surfaces stay usable with Master OFF.** Every new hook
   gated on `masterEnabled()`. If Master is off, nothing changes for
   the student. This preserves the ability to roll back Master without
   reverting the feature work.

3. **Never fail the main flow because of Master failure.** Every new
   call wrapped in try/catch with a console warn. The `updateLearnerModel`
   failure mode must never prevent XP being awarded or a card being
   saved.

4. **Stealth unless declared pedagogical.** Today the `stealthDetector`
   runs on Lesson titles and moments 1–4. We extend the policy: **any
   Master output that reaches the student** must pass stealth (thematic
   phrasing, no grammar labels) unless it's inside a moment 5 or a new
   "Reflexão" surface that is explicitly opt-in.

5. **Don't let the Master become the only path.** Every surface keeps
   its manual/random entry. Prática Sugerida and Lesson Offers are
   **additions**, never replacements. A student who just wants to
   practice something random should still be able to.

6. **Never drop a signal silently.** Any surface that evaluates a
   student production MUST either (a) call `masterEvaluate +
   updateLearnerModel`, or (b) leave an explicit comment in the file
   saying why the signal is intentionally dropped. No more accidental
   holes.

7. **Depth of evidence over speed of promotion.** Every Master
   decision that changes a pattern's state (mastered / acquiring /
   chronic) must cite multiple sessions, multiple contexts, and
   multiple modalities worth of evidence. "5 correct in a row today"
   is not evidence of mastery; it's evidence of today (see Phase 7).

8. **Negotiate with the student, never override them.** If the
   student asks to practice theme X, the Master practices theme X —
   and threads its own target-pattern inside that theme. Master
   priorities never silently replace student intent (see Phase 8).

9. **Comfortable by construction.** Master surfaces pass three
   filters before shipping:
   (a) **tone QA** — does the copy sound like a coach or a teacher?
       coaches are allowed, teachers are not;
   (b) **frequency throttle** — Master-initiated nudges cap at N per
       session, and a session the student explicitly labels "quick
       practice" gets zero;
   (c) **opt-out per channel** — reflections, nudges, and offers are
       each independently silenceable in Settings.

---

## 4. Phase 1 — Plumbing fixes

**Goal:** close the 3 obvious holes without touching any UX. Invisible
to the student but unlocks Master prescriptions that are ~3× better
within a week.

### 4.1 F-P1-01 — Wire briefing through `ExercisesPage`

- `ExercisesPage.tsx` reads `useLocation().state?.briefing as Briefing | undefined`.
- Passes it as a prop to **every** child: `ImageMode`, `OralCloze`,
  `ErrorSpotting`, `ReactionDrill`, `ActiveShadowing`, `Reformulation`,
  `NarrativeContinuation`, `DirectedListening`, `ExerciseShell`
  (for phrase/text/roleplay).
- Each child component already accepts `briefing?: Briefing`; they just
  need to actually *use* it in their `getXxxPrompt` call (some already do;
  audit per component).

**Cost:** ~1 hour total. **Impact:** Prática Sugerida can now target
drills and Visual, which tripled the addressable Master routing surface.

### 4.2 F-P1-02 — `masterEvaluate` on surfaces that already do 5D

Surfaces that already produce a full `EvaluationResult` with
`canonical_pattern` but **don't** call `masterEvaluate`:

- `ImageMode` (Desafio Visual).
- `Reformulation`.
- `NarrativeContinuation`.
- `DirectedListening` (produces a 5D-like extended eval).
- `ReviewPage` (per-card evaluation).

For each: extract the `useExerciseEvaluation` post-eval hook into a
reusable helper (`runMasterPostEval({ evaluation, briefing?, modality })`)
that:

1. Guards on `masterEnabled()`.
2. Calls `masterEvaluate({ evaluation, briefing })` → `MetaAssessment`.
3. Calls `updateLearnerModel({ evaluation, metaAssessment, modality, briefing })`.

Wire it in each of the 5 surfaces above as **fire-and-forget** after the
student sees their evaluation. No UX change.

**Cost:** ~4 hours (one helper + 5 integrations + tests).
**Impact:** LearnerModel now sees **every** written/spoken evaluation the
app produces, not just exercises.

### 4.3 F-P1-03 — Lightweight Master for drills without 5D

Drills that **don't** produce 5D today: `OralCloze`, `ErrorSpotting`,
`ReactionDrill`, `ActiveShadowing`. They emit per-round outcomes
(correct / wrong / latency / rhythm) already tied to `canonical_pattern`.

Introduce a **`recordDrillOutcome({ modality, rounds })`** helper that
calls a minimal `updateLearnerModel` path:

- Each correct round → small `acquiring_pattern.attempts++, success_rate↑`.
- Each wrong round → `canonical_pattern` evidence toward `chronic_errors`.
- Latency/rhythm thresholds → `engagement_profile` signals (e.g.
  automaticity_under_pressure).

No MetaAssessment (there isn't enough narrative). Just direct patches.

**Cost:** ~3 hours (helper + wiring in 4 components).
**Impact:** Automaticity drills finally feed the model — they were the
most wasted signal in the app, because they produce *many* small
outcomes per session.

### 4.4 F-P1-04 — Scripts page: record intent, no eval

`scripts` today produces no evaluation. We don't change that, but we
turn the situation description the student types into a cheap
engagement signal so the Master at least sees *themes that land*:

- On submit, fire-and-forget `recordScriptIntent({ text, theme? })` →
  adds a `engagement_profile.themes_that_land` candidate and a
  `engagement_profile.recent_scripts_intents[]` slot (kept short).
- No 5D eval, no MetaAssessment. The student produces a script, reads
  it, and that's it.

**Cost:** ~2 hours (one helper, one wiring point).
**Impact:** closes the last `/practice` signal hole. The Master now
knows *what the student wants to talk about* even when they're in
free-play mode.

### 4.5 F-P1-05 — Master-coverage lint rule

Add a custom ESLint rule (or a simple repo-level check script in
`scripts/check-master-coverage.ts`) that, for each file under
`src/components/exercises/`, `src/components/live/`,
`src/components/review/`, and similar production surfaces:

- Requires **either** an import of `updateLearnerModel` /
  `recordDrillOutcome` / `recordScriptIntent`, **or**
- A top-of-file `// MASTER-EXEMPT: <reason>` comment.

This is the guarantee that §2.4 stays honest as the code evolves.
Runs in CI; violations block the build.

**Cost:** ~3 hours (script + CI wiring).
**Impact:** the plan stops depending on developer memory and becomes
enforced by the toolchain.

### 4.6 Phase 1 exit criteria

- Prática Sugerida can route to Visual + any focused drill with the
  briefing injected in the generator prompt.
- LearnerModel writes happen on all 11 eval-producing `/practice`
  surfaces + Review.
- All 7 drills feed `recordDrillOutcome`.
- Scripts page feeds `recordScriptIntent`.
- The Master-coverage lint (F-P1-05) is green in CI.
- No UX regression (all existing tests green, no new UI copy).
- An end-to-end test: exercise-with-briefing → MetaAssessment →
  LearnerModel patch → next `prescribe` uses the new pattern.

---

## 5. Phase 2 — Live and Paths (the final exam, running all the time)

**Goal:** make Live the **primary signal source** of the app, not one
among many. Per §1.2, Live is where mastery is verified, where fluency
is measured, and where the student actually performs the skill the app
is trying to teach. This phase must ship before Phase 7 can produce
honest mastery judgements.

### 5.1 The challenge

Live roleplay can't use the per-exercise 5D evaluation as-is because:

- The student produces 10–30 turns, not one.
- Each turn is spontaneous, often grammatically "wrong but communicative".
- The existing `ConversationAnalysis` produces prose `improvements[]`,
  not `canonical_pattern`-tagged errors.
- Per-turn signals (latency, length, abandonment) are currently
  discarded entirely, even though they're the **actual measures of
  fluency** the app exists to move.

### 5.2 F-P2-01 — Post-conversation Master evaluation

After `ConversationAnalysis` succeeds, run a **separate Master call**
with a new prompt `getLiveConversationMasterPrompt(turns, scenario,
learnerModel)` that produces a compact `MetaAssessment`:

```
{
  "salient_patterns_observed": [
    { "canonical_pattern": "past_continuous_in_interrupted_narrative",
      "turns_correct": [4, 7, 12],
      "turns_incorrect": [],
      "evidence": "Used 3 times correctly across turns 4, 7, 12." },
    { "canonical_pattern": "article_a_vs_the",
      "turns_correct": [],
      "turns_incorrect": [2, 5, 9],
      "evidence": "Dropped articles in turns 2, 5, 9 (chronic)." }
  ],
  "automaticity_estimate": "moderate",
  "confidence_estimate": "recovering",
  "suggested_next_step": "consolidate past_continuous",
  "respects_stealth": true
}
```

Note the explicit `turns_correct` / `turns_incorrect` lists — Phase 7's
`live_confirmed` mastery criterion (§7c.3) depends on counting
**distinct correct live turns**, not just "the Master said it went
well".

Run `updateLearnerModel` with this MetaAssessment, modality=`live`,
no briefing (unless Phase 2.2 ships too).

**Why a new prompt instead of reusing `masterEvaluate`:** `masterEvaluate`
expects a single student utterance + correction list. Live is a
different shape of input, and the Master needs to spot *patterns across
turns*, not score a single turn.

**Cost:** ~7 hours (new prompt + schema with turn arrays + service +
test + wiring in `ConversationAnalysis`). **Impact:** Live finally
feeds the model **and** Phase 7 can enforce its Live-confirmed gate.

### 5.3 F-P2-02 — Master-guided scenario generation (non-optional)

Per §1.3, live-first is the default prescription mode. This makes 5.3
required, not optional.

Before `ScenarioSetup` generates the scenario:

- If `masterEnabled()`, always call
  `prescribe({ requestedExerciseType: 'live' })` → `briefing` unless
  the student explicitly picked a non-random theme (in which case
  `prescribe` receives that theme as a soft pin per Phase 8).
- Inject `briefing.target_skill` + `briefing.disguise_theme` into
  `getScenarioGenerationPrompt`. The scenario naturally creates
  opportunities to practice the target pattern.

Stealth: the scenario copy never names the pattern. It's the *situation*
that elicits the pattern.

**Cost:** ~3 hours. **Impact:** Live becomes directed without losing
spontaneity. Combined with 5.2, we close the loop — Master prescribes
opportunities, student speaks, Master evaluates, LearnerModel updates.

### 5.4 F-P2-03 — Paths as a structured Live wrapper

`/paths` reuses `LiveSession` + `ConversationAnalysis`, so Phase 2.1
automatically applies. Additional hook:

- `markStepComplete` → pass the path step's pedagogical intent
  (if any) to `updateLearnerModel` as extra context.
- Paths scenario generation consults `prescribe` the same way 5.3
  does, so a path step's scenario is also calibrated to what the
  student needs.

**Cost:** ~2 hours. **Impact:** Paths progress now counts toward the
LearnerModel, and each step is a directed live exposure.

### 5.5 F-P2-04 — `live_fluency_profile` on the LearnerModel

Per §1.2 point 4, fluency itself is measured in Live. Extend
`LearnerModel` with:

```ts
interface LiveFluencyProfile {
  // last-N-sessions rolling aggregates (N configurable, default 10)
  sessions_considered: string[];

  // how much the student actually speaks
  avg_turn_length_words: number | null;
  median_turn_length_words: number | null;
  longest_turn_words: number | null;

  // how quickly the student engages
  avg_response_latency_ms: number | null;

  // how often the student gives up mid-turn
  abandoned_turn_rate: number | null;   // 0..1

  // how rich the output is getting
  lexical_diversity_estimate: number | null;  // simple type/token ratio

  // how broad the student's conversational range is
  // (counted across the rolling window, not lifetime)
  distinct_themes_in_window: number;     // number of distinct themes
                                         //   touched in Live across the
                                         //   last sessions_considered
  themes_in_window: string[];            // the actual theme ids, for
                                         //   prescribe to bias toward
                                         //   under-represented themes

  // whether it's all going in the right direction
  trajectory: 'improving' | 'stable' | 'regressing' | 'noisy';

  // raw per-session points for the rolling window
  session_points: Array<{
    session_id: string;
    at: string;
    theme: string;                       // scenario theme used
    turns_count: number;
    avg_turn_length_words: number;
    avg_response_latency_ms: number;
    abandoned_turn_count: number;
  }>;
}
```

`ConversationAnalysis` post-processing emits a per-session data point
from the raw `turns[]` it already has — no extra LLM calls needed for
the numeric aggregates. The trajectory field reuses the same estimator
as §7c.5.

**How the theme diversity fields feed `prescribe`.** When `prescribe`
runs in live-first mode (§1.3), it consults `themes_in_window` and
biases scenario selection **away** from themes that already dominate
the window. If the student has done 4 Live sessions in the last week
and 3 of them were "workplace", the Master's next Live scenario
prefers a different frame — travel, social, daily routine, whatever
is under-represented — even if the underlying target pattern stays
the same. This is how §1.2's "variation in theme and scenario"
becomes behaviour.

`live_fluency_profile` is the **mother metric** of the app (see §11).
Everything else — patterns mastered, CEFR estimate, chronic errors —
is an intermediate variable in service of this profile improving,
and "fluency" here explicitly includes *breadth* (able to speak
across themes), not just *depth* (able to speak well about one
thing).

**Cost:** ~6 hours (type additions, deterministic aggregation,
trajectory plumbing, theme-diversity scenario bias in `prescribe`,
migration, tests). Up from ~5h because of the scenario-bias wiring.

### 5.6 F-P2-05 — Mini-live: the Master's default prescription

Per §1.2 point 3 and §1.3, live-first is the default. To make this
comfortable for students who don't want a 10-minute roleplay for a
quick practice moment, introduce a **mini-live** variant:

- ~3–4 turns, ~2 minutes.
- Reuses `LiveSession` with a new `mode: 'mini'` flag and a scenario
  prompt explicitly instructing the AI partner to wrap the
  conversation after 3–4 exchanges.
- Same post-conversation Master evaluation as 5.2, but the returned
  `MetaAssessment` is tagged `session_size: 'mini'` so Phase 7 can
  weight evidence appropriately (a mini-live correct turn counts as
  one turn, same as any other).
- Offered by default when Prática Sugerida picks "live" and the
  student hasn't pinned a longer session.

**Cost:** ~4 hours (flag plumbing in scenario generator, session
runtime, ConversationAnalysis, Master eval tagging).

**Impact:** removes the "Live is too heavy for a quick session"
friction that today pushes students into drills. Mini-live makes the
default prescription a ~2-minute spoken exchange.

### 5.7 Phase 2 exit criteria

- 100% of live conversations (full and mini) produce a `MetaAssessment`
  and update the LearnerModel.
- Every live session emits a `LiveFluencyProfile.session_points[]`
  entry and updates the rolling aggregates.
- A student who speaks their past-continuous incorrectly on Live sees
  it in their next `prescribe` suggestion within 2 sessions.
- Prática Sugerida defaults to a mini-live when nothing else pins the
  modality.
- Live UX is unchanged on the surface (same setup, same conversation,
  same analysis) except for the new mini-live entry. All Master work
  is background.

---

## 6. Phase 3 — Reflection surfaces

**Goal:** give the Master a **speaking voice** in a few designated,
opt-in places. Until now it's pure background. This is where students
start to feel the personalization.

### 6.1 F-P3-01 — Session Reflection card

After any session that involved ≥ 5 productions (exercise, review, live,
lesson), show an optional "Reflexão" card on the way back to the hub:

```
"Percebi algumas coisas interessantes hoje."

- Você está cada vez mais natural usando X. (strength evidence)
- Y apareceu 3 vezes essa sessão e ainda te dá trabalho.
- Vou deixar alguns cards de revisão sobre Y pros próximos dias.

[Entendi]  [Ver mais detalhes]  [Desligar reflexões]
```

Content produced by a new Master role `summarize_session({learnerModel,
sessionMetaAssessments})` that:

- Picks 1 strength and 1 opportunity.
- Frames both in *first-person, thematic language* (stealth: no grammar
  labels, no CEFR jargon).
- Gates strictly on `lessons_opt_in` + new flag `reflections_opt_in`.

Dismissing the card is fine. Clicking "Desligar reflexões" persists
`reflections_opt_in = false`.

**Cost:** ~8 hours (new role, prompt, component, persistence, copy
review). **Impact:** first moment where the app *feels* like a tutor,
not a generator. Risk: if the Master is wrong about an observation,
the student notices. Gating + opt-out mitigates.

### 6.2 F-P3-02 — History page annotations

`/history` lists past Live sessions. Add a small annotation to each row
pulled from the session's `MetaAssessment.salient_patterns_observed`.
Not a banner — just a subtle "foco desta conversa" subtitle.

**Cost:** ~3 hours. **Impact:** History becomes reviewable, not just
archival.

### 6.3 F-P3-03 — Error Dashboard with Master overlay

`/errors` today shows a list of error patterns sorted by recency. Add a
Master lens:

- Tag each error with its LearnerModel status: `mastered`, `acquiring`,
  `chronic`, `hard_for_user`.
- Show the Master's current priority ordering next to the raw error
  frequency.
- A "why this is prioritized" tooltip pulls the hypothesis from the
  LearnerModel.

This is the *only* place the Master uses pedagogical language directly,
because students who get to this page are explicitly looking for
analysis. Stealth doesn't apply here.

**Cost:** ~4 hours. **Impact:** transparent introspection for motivated
students. Low-traffic surface, high-trust payoff.

### 6.4 Phase 3 exit criteria

- Reflection cards are opt-in and dismissible.
- Stealth enforcement via an extended `momentIsStealth`-like check on
  reflection content before showing.
- Zero student complaints that the tutor "calls out" grammar (QA test:
  read 20 generated reflections, none should mention a grammar label).

---

## 7. Phase 4 — Always-on automaticity

**Goal:** turn otherwise-idle moments in the app into micro-practice
opportunities for `hard_for_user` patterns. This is where the Master
starts *distributing* practice throughout the student's use of the app,
not just when they click "practice".

### 7.1 F-P4-01 — Library pull from LearnerModel

Library page shows all cards. Add a small "Hoje o tutor recomenda"
section pulled from the LearnerModel's top 3 `chronic_errors`. Each
shown card is a regular card, but annotated.

**Cost:** ~2 hours.

### 7.2 F-P4-02 — Scripts page as pattern drill

`/scripts` today is a typed situation → generated dialogue. Connect it:

- If `masterEnabled()`, optionally inject the student's top chronic
  pattern into `getCustomDialoguePrompt`, so the generated script
  naturally contains that pattern in context.

Stealth: the script still reads as natural dialogue.

**Cost:** ~2 hours.

### 7.3 F-P4-03 — Lesson-Offer-style cross-surface nudges

Once Phase 1 + 2 + 3 are stable, allow the Master to surface a one-liner
elsewhere in the app:

- After 3 consecutive review cards on a `chronic` pattern: *"Que tal
  praticar isso ao vivo?"* → routes to Live with a briefing.
- After a Live session where a `hard_for_user` pattern fired: *"Vou
  preparar uns drills rápidos de pronúncia pra você."* → routes to
  `OralCloze` with briefing.

Gated on `reflections_opt_in` (same switch as Phase 3).

**Cost:** ~6 hours (cross-surface nudge engine + routing).

### 7.4 Phase 4 exit criteria

- Students who use the app casually (2 sessions/week) see ~1 Master
  nudge per week.
- No nudge if any of: Master disabled, Lessons opt-in off, reflections
  opt-in off.

---

## 7a. Phase 5 — Per-role Master model configuration

**Goal:** let us pick a different LLM for every Master role, so we can
run `evaluate` on a cheap fast model and `compose_lesson` on a heavier
one without over-paying either way. During development this lives in
Settings; in the future (out of scope here) we'll hide it from
non-dev users.

### 5p.1 What exists today

- `ModelConfig` in `src/types/settings.ts` has **one** chat model
  (`chatModel` + `chatSource`) plus a single fallback
  (`chatFallbackModel` + `chatFallbackSource`). Every Master call
  inherits this.
- `master_usage` in Supabase already logs `role`, `model`, tokens,
  latency — so the infra to see what each role costs is there. It just
  has no way to *choose* the model per role.

### 5p.2 F-P5-01 — Extend `ModelConfig` with per-role overrides

Add to `ModelConfig`:

```ts
masterModels?: {
  prescribe?:         { model: string; source: Source };
  evaluate?:          { model: string; source: Source };
  update_model?:      { model: string; source: Source };
  compose_lesson?:    { model: string; source: Source };
  render_moment?:     { model: string; source: Source };
  live_meta?:         { model: string; source: Source }; // new in Phase 2
  summarize_session?: { model: string; source: Source }; // new in Phase 3
};
```

Resolution order at call time:

1. `masterModels[role]` if set → use it.
2. Else `chatModel` / `chatSource` (today's behaviour).
3. Fallback on failure is still `chatFallbackModel` / `chatFallbackSource`.

### 5p.3 F-P5-02 — Route model through to `chatCompletion`

Every Master role today calls `chatCompletion({ systemPrompt, userMessage })`
without a model override. Change each of the 5 (soon 7) roles to:

```ts
const { model, source } = resolveMasterModel('prescribe');
chatCompletion({ systemPrompt, userMessage, model, source });
```

`resolveMasterModel(role)` lives next to `runtimeConfigSnapshot.ts` so
it reads the same snapshot the Master gate already uses.

### 5p.4 F-P5-03 — Settings UI

Add a new block in `SettingsPage.tsx`:

```
┌── Master (advanced) ──────────────────────────────────┐
│  Choose a model for each Master role. Leave blank     │
│  to inherit the main chat model.                      │
│                                                       │
│  prescribe         [ dropdown: provider + model ]     │
│  evaluate          [ dropdown ]                       │
│  update_model      [ dropdown ]                       │
│  compose_lesson    [ dropdown ]                       │
│  render_moment     [ dropdown ]                       │
│  live_meta         [ dropdown ]  ← added by Phase 2   │
│  summarize_session [ dropdown ]  ← added by Phase 3   │
└───────────────────────────────────────────────────────┘
```

Reuses the existing `ProviderSelect` + `ModelSelect` pair. Persists
via `updateProfile({ model_config })` (already the mechanism for main
model choice).

### 5p.5 F-P5-04 — Telemetry sanity check

Because `master_usage` already records `model`, we can confirm the
override is flowing by filtering `master_usage WHERE role = 'evaluate'
GROUP BY model`. No schema change needed.

### 5p.6 Phase 5 exit criteria

- Changing `masterModels.evaluate` in Settings immediately changes the
  model used by the next Master evaluate call.
- `master_usage` rows reflect the chosen model per role.
- Leaving a role blank inherits the main chat model (no regression).
- Admin note in the Settings block says "Developer config — UI will
  be gated after users exist."

**Cost:** ~5 hours (types + resolver + UI + migration-less profile
write + 1 test).

---

## 7b. Prompt iteration methodology (not a phase)

Originally framed as "Phase 6 — Prompt optimization harness" with
fixtures, an in-repo runner (`scripts/prompt-lab.ts`), graders, and CI
hooks. That was overengineered for the actual problem.

The real problem is simple: the Master prompts (`prescribe`, `evaluate`,
`update_model`, `compose_lesson`, `render_moment`, plus the new
`live_meta`, `summarize_session`, `vary_card`) need to be iterated
against real LLM outputs before we ship them. That iteration is a
personal workflow, not an app feature.

**The workflow, any time we touch a Master prompt:**

1. In `/home/hadoop/study/prompt-lab-external/` (OUTSIDE this repo),
   write a throwaway Python script that:
   - Hard-codes a realistic input dict (LearnerModel + evaluation
     context + briefing — whatever the role receives).
   - Calls Vertex Gemini (model per `gemini-vertex-ai-guide.md`, e.g.
     `gemini-3-flash-preview` for fast roles, `gemini-2.5-pro` for
     complex judgement).
   - Prints the raw output.
2. Read the output. Does it make sense? Does it respect stealth? Is
   the JSON valid? Does it promote / demote / escalate correctly?
3. Edit the prompt string inside the Python script. Re-run. Iterate
   until the output convinces.
4. Paste the final prompt as a string literal inside the corresponding
   service's `buildSystemPrompt()` function in `src/services/master/`.
5. Delete or archive the Python script. Nothing about Vertex, Nubank,
   project IDs, or base URLs enters this repo.

**What does NOT exist:**

- No `scripts/prompt-lab.ts` inside the repo.
- No fixture JSON battery in `src/services/master/__fixtures__/`.
- No `npm run prompt-lab`, no LLM-judge grader, no
  `prompt_lab_runs.json`.
- No CI integration.
- No `docs/prompt-lab.md` describing a harness.

**What IS real:** whenever Phase 2, 3, 7, or 9 changes a Master
prompt, the corresponding TODO silently includes "iterate this prompt
externally first, paste the final version." No separate phase, no
separate cost line.

---

## 7c. Phase 7 — Deep progression & mastery calibration

**Goal:** replace the current shallow promotion heuristic
(`success_rate >= 0.8 && attempts >= 5`) with a multi-dimensional
evidence requirement **anchored in Live performance over time**.
Promotion = genuine learning confirmed in conversation, not a lucky
streak in drills. This phase serves §1.1 commitments 2, 3, 5, and 6,
and is the implementation of §1.2's "Live is the final exam" promise.

**Philosophy anchor:** we have **no hurry to advance the student**.
The failure mode this phase fights is *false mastery* (declaring
learned what isn't yet learned). Slow, honest promotion is the
design intent, not a bug. A student who stays at the same rung for
three weeks because Live evidence hasn't accumulated yet is a student
being served well.

### 7c.1 Why the current rule is wrong

Today in `src/services/master/updateModel.ts`, a pattern crosses the
"mastered" bar with **5 successful attempts at success_rate ≥ 0.8**.
Problems:

- **Same-session streak passes.** 5 drills of the same pattern in one
  sitting is repetition practice, not mastery evidence.
- **No context variation required.** The student might have seen the
  pattern 5 times in cooking sentences and never in, say, workplace
  scenarios. Not mastered — just memorized in one frame.
- **No modality variation required.** 5 typed phrases pass the bar;
  the student has never spoken the pattern.
- **No time spread required.** Nothing forces evidence across
  sessions — today you can promote within an hour.
- **No Live requirement.** The student has never had to produce the
  pattern in conversation, under time pressure, with an interlocutor.
  A pattern that's only ever appeared in drills has been *rehearsed*,
  not *learned*. This is the biggest hole.
- **No retention check.** The Master never re-probes an old pattern
  to confirm it still holds. Once "mastered", a pattern is silently
  assumed mastered forever.

### 7c.2 F-P7-01 — Rich evidence structure on each acquiring pattern

Extend `AcquiringPattern` in `src/types/learnerModel.ts`:

```ts
interface AcquiringPattern {
  id: CanonicalPatternId;
  attempts: number;
  success_rate: number;
  last_seen: string;
  hypothesis?: string;

  // NEW — evidence quality fields
  evidence: {
    sessions_touched:      string[];     // distinct session ids (any modality)
    themes_seen:           string[];     // distinct engagement themes
    modalities_seen:       string[];     // phrase | text | roleplay | visual
                                         // | review | live | drill_* | lesson

    // Live-specific evidence — Phase 7's mastery gate reads these directly
    live_turns_correct:    number;       // cumulative correct live turns
    live_turns_incorrect:  number;       // cumulative incorrect live turns
    live_sessions_touched: string[];     // distinct Live session ids
                                         //   (roleplay or mini-live)
    live_themes_seen:      string[];     // distinct themes in which the
                                         //   pattern was produced
                                         //   correctly in Live (e.g.
                                         //   ["viagens", "trabalho"]).
                                         //   Computed from the scenario
                                         //   theme of each Live session
                                         //   where the pattern appeared
                                         //   in `turns_correct[]`.
    first_live_success_at: string | null;
    last_live_success_at:  string | null;

    consecutive_correct:   number;       // current streak (any modality)
    longest_streak:        number;       // historical
    first_success_at:      string | null;
    last_failure_at:       string | null;
    re_exposure_checks:    Array<{       // see 7c.4
      at: string;
      passed: boolean;
      context: string;                   // "different theme"
      was_live: boolean;                 // Live re-exposures weigh more
    }>;
  };

  trajectory: 'improving' | 'stable' | 'regressing' | 'noisy';
}
```

Every `updateLearnerModel` call updates the evidence object from the
concrete student production it just saw: which session, which theme,
which modality, and — critically — whether this was a **Live turn** and
whether it was correct. The `salient_patterns_observed[].turns_correct`
array from 5.2 is the direct input for the Live counters.

This is the **depth of evidence** §1.1.2 demands, plus the **Live
anchor** §1.2 demands.

### 7c.3 F-P7-02 — Multi-dimensional promotion gate (Live-anchored)

Replace the bar in `updateModel.ts`'s system prompt **and** in any
client-side assertion. New rule:

A pattern crosses to `mastered` only when **all** of:

1. `attempts >= 10` **and** `success_rate >= 0.8`.
2. `evidence.sessions_touched.length >= 3` — evidence is spread
   across at least three distinct sessions **of any kind**.
3. `evidence.themes_seen.length >= 2` — seen correctly in at least
   two different thematic frames.
4. `evidence.modalities_seen.length >= 2` — seen correctly in at
   least two different modalities (typed + spoken counts, phrase +
   drill counts, etc.).
5. `trajectory ∈ { 'improving', 'stable' }` — not currently
   regressing.
6. **Live-confirmed, across time AND themes.**
   `evidence.live_turns_correct >= 2` **and**
   `evidence.live_sessions_touched.length >= 2` **and**
   `evidence.live_themes_seen.length >= 2` **and**
   `last_live_success_at − first_live_success_at >= 72h`.
   Translating: the student has produced the pattern correctly in at
   least two distinct live turns, spread across at least two
   distinct live sessions, covering at least two distinct themes,
   separated by at least three days. One good live performance is
   never enough. Two good live performances in the same scenario are
   also never enough — that's topic rehearsal, not transfer.
7. `evidence.re_exposure_checks` has at least **one** passing entry
   (see 7c.4) dated at least 48h after `first_success_at` **and** at
   least one of those passing entries has `was_live = true`.

All seven conditions are hard gates — if any one fails, the pattern
stays `acquiring`, no matter how much drill evidence exists. This is
the product definition of "Live is the final exam" (§1.2).

Falls below `evidence.re_exposure_checks` bar, or live evidence ages
out? → pattern goes back to `acquiring`, not silently removed from
`mastered`. The Master transparently re-admits the pattern for
reinforcement.

**Explicit non-goal:** speed of promotion. If the evidence isn't
there, the Master waits. There is no engagement-side countermeasure
in this plan (no "make the bar easier so students feel progress") —
by design.

### 7c.4 F-P7-03 — Scheduled re-exposure (the "did it stick?" check)

Add a new Master role `re_expose` (or a `prescribe` mode flag) that
periodically picks a `mastered` pattern and threads it into a new
prescription **with a different theme / modality** than the student
originally mastered it in. The student doesn't notice — it's just
another exercise. The result is logged as a `re_exposure_checks`
entry, with `was_live = true` when the re-exposure happens inside a
Live or mini-live session.

Trigger rules:

- For each `mastered` pattern, once every
  `min(14 days, next_interval_days)` the Master has a 1-in-N chance
  of threading it into a prescription. Skewed toward patterns that
  have **never** been re-exposed since mastering.
- **Live-biased re-exposure.** When the next Live or mini-live is
  scheduled and at least one `mastered` pattern is due for a
  re-exposure check, the Master prefers threading that pattern into
  the live scenario over isolated drills. Live re-exposures (where
  `was_live = true`) carry more weight in keeping a pattern in the
  `mastered` set than isolated re-exposures.
- **Theme-diverse re-exposure.** When picking the scenario for a Live
  re-exposure, the Master prefers themes that are **not yet** in the
  pattern's `evidence.live_themes_seen` (or in its
  `evidence.themes_seen` more broadly). "Did it transfer?" is only a
  meaningful question if the re-exposure happens in a new-to-this-
  pattern frame; re-testing in an already-seen theme reinforces but
  doesn't prove transfer.
- A `mastered` pattern that fails its scheduled Live re-exposure
  check is demoted to `acquiring` immediately, regardless of how
  many isolated drills it has passed since.

This is how "progress-aware, not snapshot-aware" (§1.1.5) and "Live
is the realness check" (§1.2.1) become real.

### 7c.5 F-P7-04 — Trajectory estimator

Compute `trajectory` deterministically from the last K sessions of
evidence:

- `improving` — rolling success_rate over last 3 sessions is
  monotonically increasing.
- `regressing` — rolling success_rate over last 3 sessions is
  monotonically decreasing, OR a recent failure wiped a long streak.
- `stable` — change is within ±0.1.
- `noisy` — fewer than 3 sessions of data or high variance.

Feeds into the promotion gate (7c.3 rule 5) and into the
`prescribe` prompt so the Master can say things like "this pattern
is regressing, re-expose in a varied frame" internally.

### 7c.6 F-P7-05 — Ladder memory: next rung always ready

Every time the Master emits `mastered.add`, it MUST also emit
`plan.set` that updates `next_step_plan.primary_goal` to the next
deliberate stretch. Enforced via a check in `updateModel.ts`: if a
patch set contains `mastered.add` without an accompanying `plan.set`
whose `primary_goal` differs from the mastered pattern's id, the
whole patch set is rejected with a warning.

This ensures "promotion is always paired with a next target" (§1.1.6).

### 7c.7 Phase 7 exit criteria

- No pattern can reach `mastered` without satisfying **all seven**
  rules in 7c.3, including the Live-confirmed-across-time gate.
- `evidence` (including the Live-specific counters) is populated on
  every `acquiring_pattern` update.
- `trajectory` is computed and visible in a debug view.
- At least one `re_exposure_check` exists in the LearnerModel for any
  pattern that has been `mastered` for > 14 days.
- Unit tests: synthesized LearnerModels that pass the *old* bar but
  fail the *new* one are correctly NOT promoted.
- A simulated "lucky streak in one drill session" does not promote.
- A simulated "10 perfect drills + 1 perfect long Live" does **not**
  promote (needs the second Live, separated by ≥ 72h).
- A simulated "2 perfect Lives, both in the same `job_interview`
  scenario, 4 days apart" does **not** promote either (fails the
  `live_themes_seen.length >= 2` check).
- A simulated `mastered` pattern that fails a scheduled Live
  re-exposure is correctly demoted to `acquiring`.

**Cost:** ~22 hours (type migration including Live counters,
evidence wiring across every update call site including Live, Live
re-exposure scheduler, trajectory math, tests including the Live-
specific scenarios). Up from ~18 hours because Live evidence and
Live-biased re-exposure add real surface area.
**Impact:** promotion becomes honest. This is the single change that
most directly serves §1.1 and §1.2.

---

## 7d. Phase 8 — Intent handshake (student steers, Master weaves)

**Goal:** formalize the negotiation between **student intent** ("I
want to practice X") and **Master intent** ("you should work on Y").
This phase serves §1.1 commitment 7.

### 7d.1 What exists today

- `getPhraseGenerationPrompt` and peers accept `targetVocab`,
  `context`, `theme` — so the student CAN pass intent to a single
  generation.
- `prescribe` reads `userTheme` and `requestedExerciseType`.
- But: the student cannot declare a **standing intent** ("for this
  whole session I want to practice past tense") and have it persist.
  The student also cannot pin a word to review on demand.
- And: there's no clear blending rule — today if the student picks a
  theme, the Master silently abandons its target pattern. If the
  Master picks a target pattern, the student's theme preference is
  ignored unless they pass it again.

### 7d.2 F-P8-01 — `SessionIntent` structure

Add to the session context (can live in a Zustand store or route
state):

```ts
interface SessionIntent {
  requested_theme?:       string;        // "viagens"
  requested_vocabulary?:  string[];      // specific words
  requested_pattern?:     CanonicalPatternId | string;
                                         // "quero praticar past continuous"
  requested_modality?:    PracticeModeId; // "só oral cloze pelos próximos drills"
  requested_difficulty?:  'easier' | 'normal' | 'harder';
  review_focus?:          string[];      // specific card ids
  declared_at:            string;
  expires_at?:            string;        // default: end of session
}
```

The student sets this via:

- A new **"O que você quer praticar?"** sheet accessible from the
  Practice Hub header (one tap).
- Card-level pins ("praticar essa de novo amanhã") in Library.
- Explicit selection of a theme/vocab on existing exercise setup
  screens (already possible; just gets promoted to SessionIntent).

### 7d.3 F-P8-02 — Blending rules in `prescribe`

Extend `Briefing` with a `blend_rationale` field and teach
`prescribe` how to combine intents. Priority order:

1. **Respect student's hard pins** — `requested_vocabulary`,
   `review_focus`, `requested_modality`: these are followed 100%.
   Master's target_pattern is threaded into the chosen container,
   not swapped out for a different container.
2. **Use student's soft preferences as constraints** —
   `requested_theme` becomes the `disguise_theme`; the Master chooses
   a `target_skill` that plausibly occurs in that theme.
3. **Fall back to pure Master prescription** when the student has
   expressed no intent.

Example: student says "I want to practice viagens + past tense".
Master sees chronic error on articles. Briefing:

```
{
  target_skill: "article_a_vs_the",     // Master priority, threaded in
  disguise_theme: "viagens",             // student soft pref, honoured
  required_elements: "past tense narrative with at least 2 nouns
                      requiring articles",  // student hard pref
                                            // (pattern) woven in
  blend_rationale: "Student requested viagens + past tense; Master
                    threading article practice into the required
                    narrative."
}
```

Add a regression test that no student hard pin is ever overwritten.

### 7d.4 F-P8-03 — Per-card student pin → review focus

In Library (and eventually inline in the review UI), add a tiny "pin
for next review" affordance per card. Pinned cards jump to the front
of the next SRS queue and get a `SessionIntent.review_focus` entry
automatically.

When a card is pinned, Phase 9 (card variation) still applies —
student sees the *variant* of the pinned card, not the verbatim
original. "Practice this again, differently" is the default
semantic.

### 7d.5 F-P8-04 — "Quick practice" mode

A top-level toggle (in Settings and as a one-tap mode on the Practice
Hub): "quick practice = on" means:

- Zero Master nudges this session.
- No `LessonOfferCard`.
- No reflections at end of session.
- Prescribe still runs if user clicks "Prática Sugerida", but with
  a `quick_practice: true` flag that biases toward shorter exercises.

Implements §1.1.8 ("comfortable, never chatty") and §3.9 frequency
throttle.

### 7d.6 Phase 8 exit criteria

- Student can declare a session intent in one tap.
- Master-generated briefings respect every student hard pin without
  exception (unit tested).
- Pinning a card in Library advances it to next review.
- "Quick practice" mode silences all Master-initiated surfaces.

**Cost:** ~12 hours (SessionIntent store + UI entry + blending logic
in prescribe + unit tests + Library pin UI).
**Impact:** student no longer has to choose between "I steer" and
"Master steers". They coexist.

---

## 7e. Phase 9 — Review card variation (familiar-but-different)

**Goal:** when a card comes back for review, the student sees a
**variant** of the card — same target pattern, same difficulty
range, different surface (theme, verbs, specifics). This phase
serves §1.1 commitment 9 directly.

### 7e.1 Why this matters

SM-2 today re-shows the exact same card. Two problems:

- **Memory ≠ learning.** After the third repetition, the student is
  often answering by recall of the specific sentence rather than
  applying the pattern. Promotion (see Phase 7) then reflects memory.
- **Boring.** Users perceive the same card appearing 5 times as
  grinding. Engagement drops.

A variant that preserves the target pattern but swaps the surface
tests **transfer**, which is the actual learning objective.

### 7e.2 F-P9-01 — Card metadata for variation

Extend `Card` type with:

```ts
interface Card {
  // ... existing fields
  canonical_pattern?: CanonicalPatternId | string;
  original_prompt: string;        // snapshot of the first prompt ever
  variation_seed: number;         // RNG seed for deterministic variants
  variation_lineage: Array<{      // full history of variants shown
    prompt: string;
    shown_at: string;
    evaluation_id?: string;
  }>;
}
```

`canonical_pattern` on cards is derived when the card is first
created (usually from the exercise that spawned it) or lazy-filled
from `extractErrorPatterns`.

### 7e.3 F-P9-02 — Variant generator service

New service: `src/services/master/varyCard.ts`:

```ts
function varyCard({
  card: Card,
  learnerModel: LearnerModel,
}): Promise<{ prompt: string; context: string; briefing: Briefing }>
```

Behavior:

- If `card.canonical_pattern` is known, call a new small LLM prompt
  `getCardVariationPrompt(card, learnerModel)` that produces a new
  prompt **with the same canonical pattern** but different theme,
  verbs, and specifics. Theme is drawn from
  `engagement_profile.themes_that_land` minus the card's current
  theme (so it genuinely varies).
- The variation must preserve the card's `type` (phrase, roleplay,
  etc.) and approximate difficulty.
- If `card.canonical_pattern` is unknown, fall back to the original
  prompt with a note in lineage.

Stealth check: the variant prompt passes through `stealthDetector`
before display.

### 7e.4 F-P9-03 — Integrate into ReviewPage

`ReviewPage.tsx` today pulls `currentCard.prompt` directly. Change to:

1. Call `varyCard({ card: currentCard, learnerModel })` to get a
   variant prompt.
2. Display the variant to the student; use the variant for
   evaluation.
3. Append to `card.variation_lineage`.
4. `SessionIntent.review_focus` pins still target the same card id
   — the student just sees a *fresh variant* of their pinned card.

Behind a feature flag initially so we can A/B test engagement.

### 7e.5 F-P9-04 — Variant diversity guard

A card's `variation_lineage` is inspected before generating the next
variant. The new variant's theme MUST differ from the last 2
variants' themes, and the verb set should overlap < 50% with the
last variant. Prevents the LLM from drifting into "the same variant
over and over".

### 7e.6 F-P9-05 — The pattern-level "review session" alternative

Sometimes the right review isn't variant-of-one-card, it's
**coverage-of-one-pattern**. Add a second mode:

- If the SRS queue has ≥ 3 cards all tagged with the same
  `canonical_pattern`, the Master can collapse them into a single
  **pattern review** session that uses 3 distinct variants covering
  the pattern across themes. Counts as review of all 3 cards.

Gated on `reviews_opt_in` (same as Phase 3 opt-outs).

### 7e.7 Phase 9 exit criteria

- A card reviewed twice never shows the identical prompt twice in a
  row (unless explicitly unpinned from variation).
- Students who variance-reviewed a pattern across 3 themes have
  higher `evidence.themes_seen.length` than those who grind-reviewed,
  improving progression signal for Phase 7.
- Variation respects stealth — no variant prompt mentions a grammar
  label.
- Card `variation_lineage` is persisted and auditable per card.

**Cost:** ~10 hours (card schema migration + variant service + prompt
authoring + ReviewPage integration + diversity guard + tests).
**Impact:** closes the gap between "practised" and "learned";
unblocks Phase 7's demand for theme-variety evidence by making the
Review surface a systematic source of that variety.

---

## 8. Things we are deliberately NOT doing (yet)

These came up in the audit but are being parked on purpose. Documenting
so we don't forget the reasoning. Per the development-stage note in §0,
nothing here implies a backward-compat concern — these are all just
scoping decisions.

- **Replacing `/scripts` with a Master-driven dialog generator.** Phase 1
  (F-P1-04) adds a thin engagement signal without replacing the
  free-play nature of the surface. We can rip the page out later if it
  doesn't earn its keep.
- **Tearing down `ConversationAnalysis` in favour of the Master.** The
  existing analysis is good *student-facing* content; Phase 2 adds the
  Master *alongside* it. If in Phase 2 we decide the Master version
  subsumes it, we can delete `ConversationAnalysis` — no retrocompat
  constraint.
- **Adding STT evaluation inside Lessons' free_production moment.** The
  self-reported MomentSignal is sufficient for Stage B validation;
  richer eval can come later if signals are weak.
- **Integration with OpenAI Realtime live turn-by-turn.** We'd love to
  tag each turn as it happens, but the Realtime session doesn't expose
  turn-level transcripts reliably enough. Post-conversation batching is
  the right abstraction for now.
- **Hiding per-role model config from end users.** Phase 5 exposes
  per-role model selection in Settings for **everyone** during
  development. A future iteration will gate this behind a dev flag once
  real users exist, but that gating is explicitly **out of scope for
  this plan**.

---

## 9. Ordering and dependencies

Live anchors the whole plan (§1.2), and Phase 7's mastery gate is
literally unsatisfiable without Phase 2's Live evidence flowing into
the LearnerModel. That dependency drives the order.

```
Phase 1 (plumbing)          ── no deps
    ↓
Phase 2 (live + paths)      ── depends on P1 briefing plumbing; MUST
    │                          land before P7 can enforce its Live-
    │                          confirmed mastery gate. Also introduces
    │                          mini-live and `live_fluency_profile`,
    │                          which are the mother metric's inputs.
    ↓
Phase 7 (deep progression)  ── depends on P2's live_turns_correct /
    │                          live_sessions_touched counters. Without
    │                          P2, rule 6 of the promotion gate is
    │                          permanently unsatisfiable and no pattern
    │                          would ever promote.
    ↓
Phase 8 (intent handshake)  ── builds on P1's briefing plumbing and
    │                          P2's scenario-from-briefing capability
    ↓
Phase 9 (card variation)    ── depends on P7 (canonical_pattern on
    │                          cards) and P8 (pinned-card semantics)
    ↓
Phase 5 (per-role models)   ── can land anytime; most useful AFTER P2
    │                          (live_meta role exists) and P3
    │                          (summarize_session role exists)
    ↓
Phase 3 (reflection)        ── depends on P2 for signal quality and
    ↓                          on P7 for calibrated "what the student
    │                          is learning" content
Phase 4 (always-on)         ── depends on P3 for the nudge mechanism
                               and on P8 for respecting quick-practice
```

Recommended actual order:

1. **Phase 1 first** — mechanical plumbing, no prompt surgery. Any
   prompt touched here uses the external iteration methodology in §7b.
2. **Phase 2** — new `live_meta` prompt (iterated externally against
   Vertex, per §7b), mini-live, `live_fluency_profile`, Live-biased
   prescribe. **This is the plan's centerpiece**, not a middle step.
   Until it ships, Phase 7 cannot enforce its Live gate, and the
   mother metric in §11.1 has no signal.
3. **Phase 7** — rebuild the promotion engine honestly, now that Live
   evidence is flowing. Without P2 ahead of it, the gate is moot.
   `updateModel` prompt gets re-iterated externally for the 7-rule
   gate.
4. **Phase 8** — student can now steer. The Master is watching
   correctly (P7) across every surface (P1 + P2) so it can weave
   without compromising evidence.
5. **Phase 9** — reviews stop being grinding. New `vary_card` prompt
   iterated externally per §7b.
6. **Phase 5** — once there are enough roles to justify per-role
   configuration.
7. **Phase 3** — new `summarize_session` prompt iterated externally
   per §7b.
8. **Phase 4**.

Phases 1, 2, and 7 are the spine. They should be done by the same
person or kept in very close coordination — they all touch
`updateLearnerModel` and the pattern state machine, and Phase 2 is
explicitly upstream of Phase 7. Phase 5 can interleave anywhere after
P2.

---

## 10. Rough effort total

- Phase 1: ~13 hours (was 8; +2 for scripts, +3 for lint rule).
- Phase 2: ~22 hours — core live eval + scenario-from-briefing +
  paths hook + `live_fluency_profile` aggregator (including theme
  diversity fields and theme-bias wiring into `prescribe`) +
  mini-live mode + prompts + tests. Up from the original ~10 hours
  because Live is now the plan's centerpiece, mini-live is a real
  new surface, `live_fluency_profile` is the mother metric's data
  source, and Live scenario selection is now theme-aware.
- Phase 3: ~15 hours (includes copy review with a human — stealth is
  the hardest part).
- Phase 4: ~10 hours.
- Phase 5: ~5 hours.
- ~~Phase 6~~: **dropped as a phase.** The prompt iteration work is now
  ~0.5–1 h of external Vertex work embedded in each phase that touches
  a Master prompt (P2, P3, P7, P9). No in-repo harness, no fixtures.
- Phase 7: ~22 hours (type migration including Live counters,
  evidence plumbing across every update path, Live-biased
  re-exposure scheduler, trajectory, tests covering the Live-
  anchored gate).
- Phase 8: ~12 hours (SessionIntent store + UI + blending rules).
- Phase 9: ~10 hours (card schema + variant service + ReviewPage).

**~109 hours of focused work** (was ~129 — minus the ~20 h Phase 6
harness) to take the Master from "3 surfaces"
to "personal trainer across the whole app" — full coverage, Live as
the default signal and the mastery anchor, per-role tunability,
measurable prompt iteration, honest progression, student steering,
and non-grinding reviews.

---

## 11. Success metrics (after all 9 phases)

### 11.1 The mother metric: Live fluency over weeks

The one metric the entire plan is graded against, derived from
`live_fluency_profile` (§5.5) aggregated over the last 4 weeks of
Live and mini-live sessions per user:

**A user is succeeding when all of the following move in the right
direction over rolling 4-week windows:**

- `avg_turn_length_words` — going up (student is producing more per
  turn).
- `avg_response_latency_ms` — going down (student is engaging faster).
- `abandoned_turn_rate` — going down (student is completing more of
  what they start).
- `lexical_diversity_estimate` — going up (student is reaching for
  more varied vocabulary).
- `distinct_themes_in_window` — staying **at or above 3** (student is
  speaking across multiple scenarios, not grooving a single topic).
  A student whose Live sessions have collapsed to one theme is a
  student whose practice is narrowing, and the Master must respond
  by diversifying scenario prescriptions.
- **Correction density per 100 live turns** — going down (student is
  making fewer errors per unit of speech).

None of these are gameable by drill performance, and the theme-
diversity floor makes them un-gameable by topic-grinding either.
They only move if the student is actually speaking more, more
easily, more correctly, and **across more kinds of conversations**.
This is the single metric the product is optimizing.

### 11.2 Supporting metrics (per phase)

Every one of the following is a pre-condition for the mother metric
to move honestly — none of them is a goal on its own.

1. **Coverage:** 100% of student productions (written or spoken) in
   **every `/practice` surface** update the LearnerModel. The
   F-P1-05 lint rule is green. No `MASTER-EXEMPT` comment exists
   except in `scripts` (intent-only by design) and read-only
   reflection surfaces.
2. **Live is the default:** ≥ 60% of Prática Sugerida prescriptions
   route to a live or mini-live session when the student hasn't
   pinned a non-live modality. Drills and cloze drop accordingly.
3. **Calibration:** a planted chronic error surfaces in `prescribe`
   output within 2 sessions on any surface (previously: only phrase /
   text / roleplay), and within 1 live session after it's observed in
   a live turn.
4. **Stealth:** 0% of Master output visible to students mentions a
   grammar label (QA sample of 50).
5. **Autonomy:** students who disable Master (or `lessons_opt_in` or
   `reflections_opt_in` or who enable "quick practice") see **no**
   Master-initiated content.
6. **Reliability:** Master telemetry (`llm_usage`) shows >99%
   successful Master calls per session; failures never block the
   main flow.
7. **Per-role cost control:** `llm_usage GROUP BY role, model` shows
   at least 2 distinct models in use (e.g. heavier for
   `compose_lesson`, lighter for `update_model`) — i.e. Phase 5 is
   actually being used, not just available.
8. ~~**Prompt-lab green**~~ *(dropped)*. Replaced by §7b: every
   Master prompt change ships after an external Vertex round-trip; no
   in-repo harness is required or built.
9. **Honest promotion (drill side):** no pattern reaches `mastered`
   without at least 3 sessions, 2 themes, and 2 modalities of
   evidence. A unit-tested "lucky streak in one session" scenario
   never promotes.
10. **Honest promotion (Live side — the one that matters most):** no
    pattern reaches `mastered` without `live_turns_correct >= 2`
    across `live_sessions_touched.length >= 2` across
    `live_themes_seen.length >= 2` separated by at least 72 hours.
    A unit-tested "10 perfect drills + 1 perfect long Live" scenario
    **never** promotes; it must wait for the second Live. A
    unit-tested "2 perfect Lives in the same scenario, 4 days
    apart" **also never** promotes; it must wait for a Live in a
    different theme. A pattern that fails a scheduled Live
    re-exposure is demoted to `acquiring` on that same session.
11. **Retention confirmed in Live:** every pattern `mastered` for
    > 14 days has at least one `re_exposure_check` entry where
    `was_live = true` — either passing (stays mastered) or failing
    (returns to acquiring).
12. **Intent respected:** in a unit-tested scenario where the student
    declares `requested_theme = "viagens"` and the Master's priority
    is `articles`, the resulting briefing's `disguise_theme` is
    `"viagens"` and its `target_skill` is `articles`. Never the
    reverse.
13. **Reviews vary:** a card reviewed twice shows two different
    prompts, both passing the canonical_pattern check and the
    stealth check. Zero prompts identical-to-previous in the
    review `variation_lineage`.
14. **Comfort:** in a QA sample of 20 sessions, zero sessions contain
    more Master-initiated surfaces than the session's configured
    per-session cap (§3.9 frequency throttle). Mini-live count does
    not count as an "initiative" when it was a live-first
    prescription the student accepted.

### 11.3 Explicit anti-goals

Success is also defined by what we refuse to optimize for:

- **Not engagement.** Time-in-app, sessions-per-week, streaks — none
  of these are plan metrics. If the student learns more by speaking
  less often, that's the win.
- **Not promotion velocity.** "Patterns mastered per week" is not a
  metric. A student promoting zero patterns for a month because they
  haven't accumulated Live evidence yet is a **correctly served**
  student.
- **Not drill throughput.** "Exercises completed" per se is
  irrelevant. An exercise that didn't feed the LearnerModel or that
  was taken instead of an available live opportunity is a missed
  opportunity.

---

## 12. Related documents

- `docs/feedback-redesign-implementation.md` — the original 6-wave
  implementation, which this plan builds on.
- `docs/pending-ops-todos.md` — operational TODOs for the existing
  Waves (migrations, dry-run flip, deploy). §7 there defines the
  LLM cost-tracking workstream that complements Phase 5's per-role
  configuration: Phase 5 lets us *choose* models per role; §7 of the
  TODOs doc lets us *measure* what they actually cost.
- `src/services/master/` — current Master services that all new
  integrations extend.

---

## 13. Hard constraints for anyone executing this plan

Immutable for the entire project lifetime:

- **Never invoke Supabase CLI / DB / API** from automated tooling in
  this project. All Supabase work is authored as migration files and
  executed by the human operator. No exceptions.
- **Never push to GitHub.** Local commits are fine; `git push` is not.
  This applies across all phases.

These constraints must be respected by any agent, subagent, or script
executing work from this plan.

---

_Last updated: 2026-04-20 — revised same day to add Phases 5 through
9, the §1.1 personal-trainer commitments, the §2.4 coverage matrix,
and the §13 hard constraints. The revision reflects product feedback
that the Master must cover 100% of `/practice`, that per-role model
config plus a prompt-optimization harness belong in the plan, and
that mastery decisions must be deep (Phase 7), the student must be
able to steer (Phase 8), and reviews must vary instead of grinding
(Phase 9)._
