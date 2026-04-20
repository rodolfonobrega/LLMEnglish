# Feedback System Redesign & "The Master" Tutor

> **Status**: design document (pre-implementation)
> **Last updated**: 2026-04-20 (revision 2)
> **Author**: design conversation between product owner and AI assistant
> **Purpose**: single source of truth for the critical redesign of the feedback system, the introduction of a persistent pedagogical agent ("The Master"), the new exercise modalities, and the Lessons feature. If the original conversation is lost, this document must be enough to resume work.

---

## 0. How to read this document

This document captures five things:

1. **The critique** of the current feedback system (what is wrong today and why).
2. **The vision** of what it should become, centered on a persistent tutor agent called **The Master**.
3. **New exercise modalities** to fill pedagogical gaps the current catalogue has.
4. **The Lessons feature** — 10–20 min Master-composed pedagogical sessions.
5. **The decisions** already taken, the decisions still open, and the concrete features/components that must be built.

It is organized so that any section can be read in isolation. The **Executive Summary** (section 1) is the single page to read if you only have 5 minutes. The **Feature Catalogue** (section 7) is the implementation-ready list. The **Open Questions** (section 10) is where work must pause and ask the product owner.

Terminology used throughout:
- **Aluno / student / user** — the end user of the app.
- **Master / tutor / mestre** — the pedagogical agent being introduced. User-facing name TBD; in code: `Master`.
- **LearnerModel** — the persistent, per-user JSON document that represents what the Master knows about the student.
- **Canonical pattern** — a stable, semantic identifier for a specific linguistic phenomenon (e.g. `past_continuous_in_interrupted_narrative`), used to aggregate errors and to prescribe targeted practice.
- **Stealth curriculum / currículo invisível** — the principle that the Master's pedagogical intent is never surfaced to the student; exercises appear thematic/random even when they are deliberately prescribed.
- **Exercise** — an atomic practice unit, 30 seconds to 3 minutes. The current catalogue (phrase, text, roleplay, image, live-roleplay, scripts, review) is expanded in section 6A with 8 new modalities.
- **Lesson** — a Master-composed structured pedagogical session, 10–20 minutes, following a 5-moment PPP-adapted arc (hook → noticing → controlled practice → free production → consolidation). Defined in section 6B.

---

## 1. Executive summary

The current feedback system in LLMEnglish is **informationally rich but pedagogically inert**. It evaluates each utterance in isolation, returns a six-block wall of feedback, and persists an "error dashboard" whose aggregation logic is structurally broken (see section 3). There is no memory of the student across sessions and no intent driving the content they see. Exercises are generated randomly. The exercise catalogue is also narrow in modality: all current exercises are *synchronous solo production*, leaving major pedagogical gaps (no pure listening, no active shadowing with comparison, no reformulation, no open-ended narrative, no reaction drills).

The redesign has four intertwined goals:

1. **Fix the feedback surface** — make it multidimensional, actionable, and structured as *practice*, not as a *report*.
2. **Introduce The Master** — a persistent, silent pedagogical agent that maintains a per-user `LearnerModel`, prescribes every generated exercise, re-evaluates the student's state after each session, and drives a CEFR-anchored progression loop. Exercise content stops being random and becomes a disguised sequence of deliberate pedagogical moves.
3. **Expand exercise modalities** — add 8 new exercise types (E1–E8 in section 6A) that cover the missing pedagogical territory: active shadowing with comparison, oral cloze, listening comprehension, reformulation, error spotting, open-ended narrative, reaction drills, and minimal-pair pronunciation work. These modalities give the Master a richer palette to prescribe from.
4. **Introduce Lessons** — a Master-composed 10–20 min structured session that addresses a specific pedagogical need (chronic error, stuck acquiring pattern, breakthrough opportunity) through a 5-moment arc. Lessons are the only place where the Master briefly "appears" — but thematically named, never labeled grammatically. Lessons are **opt-in** and gated by intelligent triggers; they are not imposed on the student.

The Master is **silent by default** (user does not see it, does not know it exists) during normal exercise flow. It operates through four server-side LLM roles — `prescribe`, `evaluate`, `update_model`, and `compose_lesson` — and mutates a Supabase-backed `LearnerModel` row. All existing generation entry points accept an optional Master briefing as a constraint.

The redesign is deliberately built **on top of the existing architecture**, not as a replacement. The current `EvaluationResult` schema, the existing generation prompts, the `errorAnalysis` service, and the Supabase schema are all extended, not rewritten.

---

## 2. Context: what exists today

This section is a factual snapshot of the codebase as of 2026-04-20 so a future reader can orient quickly.

### 2.1 Shape of the existing feedback pipeline

Three feedback paths exist, all LLM-mediated.

**Path A — solo exercises** (`phrase`, `text`, `roleplay`, `image`):
- `src/components/discovery/ExerciseMode.tsx` generates a prompt using one of `getPhraseGenerationPrompt` / `getTextGenerationPrompt` / `getRoleplayGenerationPrompt` from `src/utils/prompts.ts`.
- User records audio. `AudioRecorder` → `speechToText` → transcription string.
- Transcription + prompt → `getEvaluationPrompt` → LLM returns JSON matching `evaluationResponseSchema` (`src/utils/prompts.ts`).
- Result is typed as `EvaluationResult` (`src/types/card.ts`) with fields: `score`, `correctedVersion`, `betterAlternatives`, `highlights`, `corrections[{tip, example}]`, `overallFeedback`, `userTranscription`.
- Rendered by `src/components/shared/EvaluationResults.tsx`.
- Error patterns are extracted via `extractErrorPatterns` in `src/services/errorAnalysis.ts` and persisted to Supabase.

**Path B — live roleplay**:
- `src/components/live-roleplay/LiveSession.tsx` orchestrates a voice conversation via `openaiRealtimeLive.ts` or `geminiLive.ts`.
- On finish, `src/components/live-roleplay/ConversationAnalysis.tsx` calls `getConversationAnalysisPrompt`, receives `{improvements[], cleanDialogue[], overallFeedback}`, and persists via `saveLiveSession`.

**Path C — error dashboard**:
- `src/components/errors/ErrorDashboard.tsx` reads from `errorAnalysis.ts` which queries Supabase tables `error_patterns` and `error_snapshots`.
- Patterns are categorized by keyword regex in `guessCategory()`.
- "Recommended focus" is computed from `identifyWeakAreas()`.

### 2.2 Shape of the existing Supabase schema (relevant parts)

- `error_patterns` — one row per `(user_id, pattern_key)` where `pattern_key` is derived from the correction text.
- `error_snapshots` — daily rollups per user.
- `live_sessions` — full persisted conversations with embedded analysis.
- `cards` — SRS cards with `latestEvaluation`, `reviews[]`, SM-2 fields, `theme`, `context`, `targetVocabulary[]`.

### 2.3 Tone system

`ConversationTone = 'casual' | 'balanced' | 'formal'` is a **global** user setting (`storage.ts`). It is injected into every generation and evaluation prompt via `getToneInstruction()`. It does not vary per scenario.

### 2.4 Orphan code worth knowing about

- `getTutorExplanationPrompt` (`src/utils/prompts.ts`) exists and is well-designed but is **never called from any component**. It was built to provide on-demand deeper explanation of a single correction.
- `pronunciationFeedback` field is commented out in `EvaluationResult` (`src/types/card.ts`).

---

## 3. The critique (why today is not enough)

Each point below is an independent failure mode. They are ordered by severity.

### 3.1 The single 0–10 score is an anti-pattern

Implemented in `ScoreDisplay.tsx` and requested in `getEvaluationPrompt`. Three failures:

- **Non-reproducible.** The same audio evaluated twice returns different scores. Users read that as regression.
- **Non-actionable.** "You got 7" does not say in *what*.
- **Lossy.** "Soou nativo?" is a convolution of at least five dimensions (grammar, naturalness, fluency/rhythm, vocabulary, pragmatics). Compressing into one number destroys the signal.
- **Incentives the wrong behavior.** Students play defensively to "not lose points" instead of experimenting.

### 3.2 The feedback surface is a passive wall, not an interaction

`EvaluationResults.tsx` stacks six blocks of identical visual weight. Most users read the first and the score, and close. Nothing is interactive: there is no way to practice a correction immediately, ask why, or get more examples. "Corrected version" vs "Better alternatives" overlap semantically and confuse users. "Highlights" is frequently padded by the LLM to fill the field.

### 3.3 The error-pattern aggregation is structurally broken

The single most severe bug in the system today. In `errorAnalysis.ts`:

- `patternId = ${category}_${correction.slice(0, 30).replace(/\s+/g, '_')}` — the ID is derived from the **first 30 chars of the Portuguese tip text**. The same underlying error, phrased differently by the LLM in different sessions ("Use 'gonna'…" vs "Você falou 'going to'…"), produces **different pattern rows**. The `occurrences` counter therefore almost never increments. The dashboard's numbers are fiction.
- `guessCategory()` is keyword regex on Portuguese. But prompts instruct the LLM to write natural coaching language. Most tips land in `other`. The category breakdown is meaningless.
- There is no canonical, semantic identity of the error.

Downstream: `identifyWeakAreas()`, trend computation, "recommended focus", and all dashboard counts are all contaminated.

### 3.4 The pedagogical loop does not close

Detection exists (flawed but present). Targeted practice is wired (`getCardsForWeakArea`) but depends on `card.theme` containing category keywords like `preposition`, which no card ever has (cards are themed `food`, `travel`, etc.). In practice, every call falls through to a generic low-score fallback. And `getErrorCurrency` marks a pattern as "resolved" purely by elapsed time since last seen — which rewards abandonment, not learning.

### 3.5 Feedback is an event, not a process

After the `EvaluationResults` screen, the only choices are save / retry / new. No immediate shadowing, no side-by-side audio, no "why is this wrong?" (the `getTutorExplanationPrompt` orphan), no spaced repetition of the specific error type.

### 3.6 Pronunciation and prosody are blind spots

The app's product promise is spoken English. Evaluation is done on the transcription string. Pronunciation, rhythm, intonation, connected speech — none are measured. The commented-out field in `EvaluationResult` documents this gap.

### 3.7 Feedback is not calibrated to proficiency

The same evaluation prompt runs for a B1 and a C1. The B1 gets ten corrections and disengages; the C1 gets two and feels the app is shallow. No concept of zone of proximal development.

### 3.8 Tone is global, not contextual

`ConversationTone` is a user setting. In a formal Google interview roleplay, the evaluator still treats casual tone as the target if the user has it configured globally. Evaluation and scenario diverge.

---

## 4. The vision: The Master

The central idea: introduce a **persistent pedagogical agent** that observes the student across all sessions, maintains a living model of them, and drives the content the student sees toward the next rung of the CEFR ladder. It is silent — the student never sees it exist.

### 4.1 What the Master is, in one sentence

The Master is the server-side function that sits **between the student's intent to practice and the content the app generates**, reading from and writing to a per-user `LearnerModel`, making every exercise a deliberate but disguised pedagogical move.

### 4.2 The stealth principle

The student says: "I want a phrase exercise about food." The Master has read the `LearnerModel`, sees that the student is consolidating `past_continuous` and has been avoiding `phrasal_verbs`. The Master writes a briefing: "Generate a food-themed phrase whose natural translation requires `was/were -ing` interrupted by `past_simple` and uses at least one phrasal verb in its expected answer." The generator produces: *"Eu estava almoçando ontem quando meu chefe ligou pra avisar que a reunião tinha sido adiada."*

The student never hears "past continuous". The exercise feels thematic. But the Master has engineered a precise diagnostic opportunity.

This is the single most important design principle. Breaking it (by showing a "today's target: past continuous" banner) collapses half the value.

### 4.3 Three operating modes

The Master is **not one LLM call**. It is three, at different cadences:

- **`Master.prescribe(learner_model, request)` — before generation.** Returns a structured briefing (target skills, disguise theme, difficulty delta, required/forbidden elements, success criteria).
- **`Master.evaluate(learner_model, evaluation_result, briefing) ` — after the normal evaluation.** Returns meta-assessment (was the goal met? what unexpected errors? engagement signal? next recommendation?). This is the Master's *reading* of the session, distinct from the student-facing feedback.
- **`Master.update_model(learner_model, meta_assessment)` — async, after evaluation.** Returns a **structured patch** (not a full regenerated JSON) that is deterministically applied to the `LearnerModel`. See section 5.3 for why this matters.

Each mode has a separate prompt, can use a separate (possibly smaller) model, and can be cached, queued, or deferred independently.

### 4.4 Relationship to the critique

Out of the 8 critique points in section 3, the Master directly addresses:

- **3.1** — the Master operates on a multidimensional scorecard (section 6.1) and canonical patterns. A student-facing score may remain for motivation but is no longer the system's truth.
- **3.2** — the Master selects which 1–2 corrections actually matter for the current plan step, reducing noise in the feedback surface.
- **3.3** — the LLM that produces the evaluation now also returns a `canonical_pattern` per correction (section 6.2), replacing the broken regex. The Master consumes this.
- **3.4** — this is the Master's reason to exist. The loop closes by construction.
- **3.5** — the Master sequences sessions with intent, turning isolated events into a process.
- **3.7** — the Master carries the CEFR estimate and the next-step target; every prompt is calibrated via its briefing.
- **3.8** — the Master decides the effective tone per exercise, potentially overriding the global preference when the scenario or pedagogical goal demands it.

Points **3.6 (pronunciation)** and a part of **3.5 (feedback-as-drill UI)** remain orthogonal and are listed separately in the feature catalogue.

---

## 5. The `LearnerModel`

This is the central data structure. Everything else in the Master architecture reads from or writes to this.

### 5.1 Canonical schema (v1)

Stored in a new Supabase table `learner_models`, one row per user.

```json
{
  "user_id": "uuid",
  "schema_version": 1,
  "cefr_estimate": {
    "current": "B1",
    "confidence": 0.7,
    "target": "B2",
    "last_reassessed": "2026-04-18T..."
  },
  "mastered": [
    {
      "pattern": "present_simple_3rd_person_s",
      "since": "2025-11-03",
      "evidence_count": 14
    }
  ],
  "acquiring": [
    {
      "pattern": "past_continuous",
      "first_seen": "2026-03-15",
      "success_rate_recent": 0.6,
      "blocked_by": ["confusion_with_past_simple"],
      "last_practiced": "2026-04-18",
      "attempts": 7
    }
  ],
  "chronic_errors": [
    {
      "pattern": "article_the_before_generic_plurals",
      "occurrences": 11,
      "teaching_attempts": 3,
      "hypothesis": "L1 interference — Portuguese omits article where English uses it"
    }
  ],
  "avoidance_patterns": [
    "avoids phrasal verbs in favor of latinate verbs"
  ],
  "strengths": ["wide vocabulary", "clear simple-sentence structure"],
  "engagement_profile": {
    "themes_that_land": ["food", "travel"],
    "themes_that_flop": ["business"],
    "average_session_length_min": 8,
    "preferred_intensity": "casual",
    "frustration_signal": "low"
  },
  "next_step_plan": {
    "primary_goal": "consolidate past_continuous in narrative interruption contexts",
    "secondary_goal": "introduce conditional_second_type through hypothetical scenarios",
    "avoid_for_now": ["subjunctive", "inverted_conditionals"],
    "estimated_sessions_to_goal": 5,
    "plan_created_at": "2026-04-15T..."
  },
  "session_history_summary": {
    "total_sessions": 47,
    "last_7_days_count": 5,
    "last_session_at": "2026-04-20T..."
  },
  "last_updated": "2026-04-20T..."
}
```

### 5.2 Field semantics

- `mastered` — patterns demonstrated correctly at least N times (initially N=5) over at least 3 separate sessions, with no recent regression. Never pruned aggressively — mastered items stay to inform prescriptions ("this student already handles X, build on it").
- `acquiring` — patterns actively being worked on. A pattern is promoted from `acquiring` to `mastered` when thresholds are met. It is demoted (removed) if the student shows they can't yet engage with it after 3+ teaching attempts (Master chooses to defer).
- `chronic_errors` — patterns that have been corrected but keep recurring. These get special prescription treatment: indirect exposure in multiple contexts rather than head-on drilling.
- `avoidance_patterns` — things the student *could* use but doesn't. The Master may prescribe exercises that make avoidance impossible without making it obvious.
- `next_step_plan` — the current intent. This is the single most important field for `prescribe()`.
- `engagement_profile` — metadata that lets the Master disguise targets in themes that work.

### 5.3 The patch protocol (critical for long-term stability)

**Do not** let the LLM regenerate the full `LearnerModel` on each update. Over hundreds of updates, drift will corrupt it (fields renamed, data lost, structure mutated).

Instead, `Master.update_model` returns a **list of typed patches** that a deterministic server-side function applies. Example patch output:

```json
{
  "patches": [
    { "op": "promote_to_mastered", "pattern": "present_perfect_for_experience" },
    { "op": "add_to_acquiring", "pattern": "phrasal_verb:look_into", "hypothesis": "recognizes but avoids" },
    { "op": "increment_chronic_error", "pattern": "article_the_before_generic_plurals" },
    { "op": "update_cefr", "current": "B1+", "confidence": 0.75 },
    { "op": "replace_next_step_plan", "plan": { ... } },
    { "op": "note_engagement_signal", "signal": "frustrated" }
  ],
  "rationale": "Short internal note for debugging, not user-facing."
}
```

The set of valid ops is a closed enum defined in code. Unknown ops are logged and ignored. This guarantees:

- Schema stability over time.
- Auditability (patches are logged to `learner_model_history` table).
- Safe rollback (reverse any patch).
- Easier testing (patches are deterministic inputs).

### 5.4 Bootstrapping (the cold start problem)

A new user arrives with an empty `LearnerModel`. The first 2–3 sessions are **diagnostic mode**: the Master generates deliberately varied content across difficulty and topic to probe the student. During this phase `cefr_estimate.confidence < 0.5` and `next_step_plan.primary_goal` is `"diagnostic"`. Prescriptions look different (wide spread, not a narrow target). Normal operation begins when confidence crosses a threshold (initially 0.6).

The student is not told about diagnostic mode (stealth principle holds).

### 5.5 Privacy and user control

The `LearnerModel` is a pedagogical portrait. It is:

- **RLS-protected** in Supabase (user can only read/write own row).
- **Viewable** by the user via a future debug/settings surface (not a priority for v1). They can see what the system believes about them.
- **Resettable** via a confirmed action. Reset clears the model and restarts diagnostic mode.
- **Not editable field-by-field** by the user (too easy to corrupt the reasoning chain).

---

## 6. Feedback surface redesign (student-facing)

This section describes what the student experiences, independent of the Master operating underneath.

### 6.1 The 5-dimensional scorecard

Replace the single `score` with a structured object. Extend `EvaluationResult`:

```ts
interface EvaluationScores {
  naturalness: number;  // 0-100, sounds like a native speaker
  accuracy: number;     // 0-100, grammar + vocabulary correctness
  fluency: number;      // 0-100, rhythm, pace, hesitation
  pragmatics: number;   // 0-100, appropriate for context/tone
  completeness: number; // 0-100, actually answered the prompt
}

interface EvaluationResult {
  scores: EvaluationScores;
  primary_dimension: keyof EvaluationScores; // weakest one, focus of session
  // ...existing fields extended
}
```

UI: a compact row of 5 small bars + one highlighted callout of the `primary_dimension`. The old 0–10 may be preserved internally as `(sum / 5) / 10` for backward compatibility with existing cards and XP math.

### 6.2 Canonical patterns in corrections

Extend each correction with machine-readable identity:

```ts
interface CorrectionItem {
  tip: string;           // existing, Portuguese
  example?: string;      // existing, English
  category: ErrorCategory;              // NEW: LLM-assigned, no more regex
  canonical_pattern: string;            // NEW: stable semantic ID
  severity: 'critical' | 'moderate' | 'polish'; // NEW
}
```

The evaluation prompt is extended to require these fields. The existing `guessCategory()` regex is **deleted**. The `pattern_key` in `error_patterns` becomes `canonical_pattern` directly.

A starter vocabulary of canonical patterns is defined in `src/services/patterns.ts` (new file). Initial set includes common grammar patterns (e.g. `past_continuous`, `present_perfect_experience`, `third_conditional`), common pragmatics patterns (`formal_register_in_casual_context`, `missing_discourse_marker`), and common L1-interference patterns (`article_the_before_generic_plurals`, `preposition_at_vs_in_time`). The LLM is allowed to emit patterns outside this list; unknown ones are logged for future taxonomy expansion.

### 6.3 Feedback-as-practice (not feedback-as-report)

After an evaluation, the default flow becomes a **60-second drill** before the full report:

1. **"You said this"** — playback of user's audio + transcript.
2. **"What changed"** — word-level diff between user's transcription and `correctedVersion`, with an audio button on the native version.
3. **"Try again"** — mic reopens, student repeats the corrected version. System compares.

Only after the drill (or via a "skip to full feedback" link) does the full `EvaluationResults` card appear. The full report is opt-in, not default. The student is now *practicing* the correction before reading about it.

### 6.4 On-demand explanation (plugging the orphan)

Each `CorrectionItem` gets a "Por quê?" button that invokes `getTutorExplanationPrompt` (already in `prompts.ts`, just never called) and streams the response inline. This is the cheapest high-impact change in the surface.

### 6.5 Noise reduction: Master filters corrections

When Master is active, `Master.evaluate` returns which corrections advance the current `next_step_plan`. Those get displayed prominently. Others are collapsed into a "see all" section. The student still sees everything if they want, but visually the UI prioritizes the 1–2 corrections that matter *now*.

### 6.6 Effective tone per exercise

Replace direct use of the global `ConversationTone` in evaluation prompts with `getEffectiveTone(scenario, global_setting)`. Scenarios carry their own expected tone derived from `characterSpeechStyle` and character personality. Exercise modes can also be told by the Master that today's tone is deliberately different (part of progression — e.g. introducing formal register).

---

## 6A. New exercise modalities

The current exercise catalogue (phrase, text, roleplay, image, live-roleplay, scripts, review) is **all synchronous solo production**. Major pedagogical territories are uncovered: pure listening, active shadowing with comparison, reformulation, fluency under continuous output, reaction-time automaticity, phonetic discrimination. This section adds 8 modalities to close those gaps. They are listed by letter (E1–E8) and mapped to features (F23–F30) in section 7.

Each modality:
- Is short (≤ 3 min per round) unless noted.
- Can be prescribed by the Master (every modality accepts a `Briefing`).
- Emits an `EvaluationResult` or a modality-specific analogue that feeds the `LearnerModel`.
- Respects the stealth principle: modality type is visible to the student, but the *targeted pattern* is not.

### 6A.1 Why these 8, and what each covers

The current catalogue is missing, at minimum:

- **Pure listening / comprehension** — the student never practices understanding without producing.
- **Active shadowing** — passive "listen and repeat" exists in `ConversationAnalysis`, but no system-driven comparison of the student's copy against the native audio.
- **Reformulation** — switching register is a distinct skill from translating or answering. Currently untrained.
- **Fluency under continuous output** — all current exercises end after 1–2 sentences. There is no "speak for 60 seconds without stopping" test.
- **Reaction-time automaticity** — the gap between B2 and C1 is largely response speed. Currently untrained outside of live-roleplay (which is continuous, not drill-style).
- **Phonetic discrimination** — minimal pairs, consonant clusters, prosodic contrast. Currently untrained, and will matter once the pronunciation layer (D1) ships.
- **Error noticing** — the ability to hear an error in English, not just produce it correctly, is a precondition for self-correction in conversation.
- **Oral cloze** — a high-volume, low-friction modality that lets the Master gather dense signal fast, especially for prepositions, articles, collocations.

The 8 modalities below are chosen to cover exactly these territories with minimal overlap.

### 6A.2 The 8 modalities

**E1 — Active Shadowing (comparative).**
Native audio plays a short line (5–10s). The student must repeat immediately while the line is still echoing in memory. The system records and returns:
- Word-level accuracy (did they say the right words?).
- Timing alignment (did pace match the native?).
- Prosody delta (v2, after D1 lands — pitch contour comparison).

Pedagogical target: pronunciation, rhythm, connected speech, memorization of chunks.
Duration per round: 10–20s. Typical session: 5–10 rounds.
Evaluation output: per-round accuracy + aggregate rhythm score, surfaced as a compact scorecard.

**E2 — Oral Cloze.**
TTS speaks a sentence with a short beep or silence replacing 1–2 target tokens. Student must speak only the missing token(s). Examples:
- *"I always go ___ work by bus."* → target `to`.
- *"She's been working here ___ 2019."* → target `since`.

Pedagogical target: prepositions, articles, collocations, modals, discourse markers. Extremely high signal-to-cost ratio for the Master — cheap to generate, fast to answer, gives a precise binary signal on a specific pattern.
Duration per round: 5–10s. Typical session: 10–20 rounds.
Evaluation output: correct/incorrect per round + pattern-linked stats; the correct answer can be echoed with TTS for immediate reinforcement.

**E3 — Directed Listening (comprehension).**
TTS plays a 30–60s monologue or short dialogue (potentially with an accent variation the student has been avoiding). Afterward, the student answers 2–3 comprehension questions **in spoken English**, or reformulates the key idea.

Pedagogical target: listening comprehension (currently untrained), accent exposure, gist extraction, delayed production.
Duration: 2–4 min total. Often stand-alone; rarely clustered.
Evaluation output: comprehension accuracy (LLM-judged against the source content) + production quality on the answer.

**E4 — Reformulation.**
Student is given (read or heard) a source sentence and must reformulate toward a target style. Possible targets:
- *More casual* — "I would like to inform you…" → "Just letting you know…"
- *More formal* — "I wanna get it done" → "I'd like to have it completed."
- *Shorter* — "What I mean to say is that…" → "Basically, …"
- *More natural* — direct attack on the "engessagem" the existing prompts already combat.
The Master chooses the target based on what the student most needs.

Pedagogical target: register awareness, pragmatics, idiom substitution, concision.
Duration per round: 20–40s. Typical session: 3–5 rounds.
Evaluation output: full `EvaluationResult` focused on pragmatics + naturalness dimensions.

**E5 — Error Spotting.**
TTS speaks a sentence containing exactly one deliberately planted error. The student hears it and must speak the corrected version. The Master chooses which error type to plant, drawing from the student's `chronic_errors` list (indirect exposure) or `acquiring` patterns (active contrast).

Pedagogical target: develops the auditory ear for the student's own error patterns — a meta-skill that enables self-correction in real conversation. This directly attacks chronic errors by training recognition, not just production.
Duration per round: 15–30s. Typical session: 5–10 rounds.
Evaluation output: correct/incorrect identification + quality of the stated correction.

**E6 — Open-Ended Narrative (continuation).**
TTS speaks the first 1–2 sentences of a story or situation. The student continues for 30–60 seconds without stopping. No prompt structure, no target vocabulary visible to the student.

Pedagogical target: extended fluency, cohesion, tense sequencing, discourse markers in flow, self-recovery after errors. The closest thing to "speaking English for real" outside of live-roleplay, and the only exercise that tests sustained output.
Duration per round: 1–2 min.
Evaluation output: full `EvaluationResult` with particular emphasis on fluency + cohesion dimensions. Also records speaking-time stats (words per minute, hesitation count when the pronunciation layer ships).

**E7 — Reaction Drill (call-and-response).**
A rapid-fire sequence of 8–12 short provocations. Each one the AI drops a line; the student has ≤3 seconds to respond naturally. No thinking, no planning.
- *"Hey, long time no see!"* → *"Oh my god, yeah! How've you been?"*
- *"Is Monday good for you?"* → *"Works for me"* / *"Yeah, sounds good"*.

Pedagogical target: automaticity, short responses, backchanneling, natural first-response patterns. The core skill that separates intermediate from advanced: speed with naturalness.
Duration total: 2–4 min for the whole set.
Evaluation output: per-round latency + naturalness; aggregate "automaticity score".

**E8 — Minimal Pairs & Phonetic Discrimination (gated on D1).**
Two native audios play consecutively. Either (a) they are different, and the student must identify which sound differed; or (b) the student must produce a target word distinguishing it from its minimal pair (*ship* vs *sheep*, *bit* vs *beat*).

Pedagogical target: phonetic perception and production of sounds that do not exist contrastively in Portuguese. Not essential for v1; becomes high-value once the pronunciation layer (D1 in section 7.5) is implemented.
Duration per round: 5–10s.
Status: **Defer until D1 lands.** Listed for completeness.

### 6A.3 How the Master uses the new modalities

The Master's `prescribe` receives not just a request for content but a choice of **which modality best serves the current plan step**. Examples:

- Goal: reinforce a chronic preposition error → modality choice: **E2 (oral cloze)** targeting that preposition. Dense signal, low fatigue.
- Goal: introduce past continuous → modality choice: **E6 (narrative continuation)** starting a story mid-action. Past continuous is natural there, absence is obvious.
- Goal: combat formality engessada → modality choice: **E4 (reformulation, casual target)** using the student's own prior stiff output as input.
- Goal: train speed without sacrificing naturalness → modality choice: **E7 (reaction drill)** focused on short responses.
- Goal: train the ear for an error that keeps recurring → modality choice: **E5 (error spotting)** planting exactly that error.
- Goal: test gist comprehension → modality choice: **E3 (directed listening)**.
- Goal: polish pronunciation / rhythm on a pattern already known → modality choice: **E1 (active shadowing)**.

This modality-aware prescription is one of the main reasons the Master becomes meaningful: it picks the right tool, not just the right content.

---

## 6B. Lessons — Master-composed pedagogical sessions

A **Lesson** is a structured 10–20 minute pedagogical session composed by the Master to address a specific need of a specific student. Unlike an exercise, a Lesson has a **fio narrativo** (a narrative thread), internal progression, and a 5-moment arc. Lessons are the only place in the app where the Master briefly surfaces as a tutor voice — but thematically named, never labeled grammatically.

Lessons are **opt-in**. The Master suggests them; the student can accept, dismiss, or ignore. They never replace normal exercise flow; they augment it.

### 6B.1 Why Lessons (and why they are not just "longer exercises")

Three capabilities that individual exercises cannot provide:

1. **Sense of progression.** A Lesson has a beginning, a middle, and an end. That narrative shape produces a completion experience that a chain of isolated drills cannot. This is motivational scaffolding, which in turn drives retention.
2. **Teaching, not just consolidating.** Some patterns require *exposure and noticing* before *production*. Drills are great at consolidating patterns the student has already seen. They are bad at introducing new ones. Lessons fill this gap with a noticing moment (see 6B.3.2).
3. **Breaking chronic-error cycles.** A `chronic_error` is, by definition, an error the student corrects when prompted and then re-makes. Drills correct it each time but never break the cycle, because the student has not grasped the underlying mechanism. A Lesson dedicated to that specific error, with *examples drawn from the student's own past attempts*, can break the cycle in ways drills cannot.

### 6B.2 The four pitfalls a Lesson must avoid

These were identified explicitly and must guide the implementation. Violating any of them compromises the feature.

**P1 — Becoming textbook.**
If a Lesson sounds like *"Today we'll study past continuous! Past continuous is formed with was/were + verb+ing…"*, it has failed. That is Duolingo Plus. Lessons must sound like **a conversation with a tutor who knows you**, not a grammar explanation.

**P2 — Breaking the stealth principle.**
The Master is silent by design (decision D-1). A Lesson inherently has a topic. The resolution: Lessons carry a **thematic name**, never a grammatical label.
- Forbidden: *"Lesson: Past Continuous"*
- Allowed: *"A story worth telling"* (target: past continuous)
- Allowed: *"Saying less, meaning more"* (target: phrasal verbs replacing latinate verbs)
- Allowed: *"Quick answers that sound natural"* (target: short responses + discourse markers)

The target pattern is revealed **only at the end**, in the consolidation moment, as a motivational payoff. See 6B.3.5.

**P3 — Cost and latency.**
A naïve implementation generates all 5 moments in one giant LLM call (expensive, slow first token, non-adaptive). A fully reactive implementation generates each moment just-in-time (adaptive but costly and stateful). The chosen middle path is the hybrid approach described in 6B.4.

**P4 — Building before validating.**
A Lesson is a feature that can easily consume months of work before product-market signal confirms students actually want it. Validation gates are defined in section 10 (Q-9) and section 11 (R-8).

### 6B.3 Anatomy of a Lesson — the 5 moments

Based on the Presentation-Practice-Production (PPP) pedagogical framework, adapted. Total duration: 12–18 minutes. Each moment emits signal that shapes the next.

#### 6B.3.1 Moment 1 — Hook (~1 min)

A conversational opening that **naturally exposes the target pattern without announcing it**. Example for a past-continuous lesson:

> *"So — me conta uma coisa: o que você tava fazendo ontem às 20h? Em inglês."*

The student responds. They likely either produce the target pattern (useful data) or avoid/mangle it (also useful data). This is a **live diagnostic**.

The hook's content is drawn from the `engagement_profile` to maximize the chance the student will engage genuinely rather than performatively.

**Signal captured:** baseline production of the target pattern at the very start of the lesson. Used later for the consolidation callback (6B.3.5).

#### 6B.3.2 Moment 2 — Noticing (~2 min)

The Master presents 2–3 short contrasting examples in audio (TTS) and/or text. The student is asked to **notice the difference**, not to produce. Example:

> *"Escuta essas duas: 'I was cooking when she called' e 'I cooked when she called'. O que mudou no sentido?"*

The student attempts an explanation (in Portuguese or English, their choice). The Master validates, corrects, or expands. If the student already grasps the distinction, this moment is shorter and the lesson is tilted harder toward production.

This is the only moment where the Master allows itself to be briefly didactic — but conversationally, not pedantically.

**Signal captured:** awareness level of the target pattern. Informs whether the remaining moments skew harder toward drilling (student did not notice) or toward production (student noticed).

#### 6B.3.3 Moment 3 — Controlled practice (~4 min)

A rapid sequence of 5–8 mini-exercises drawn from the new exercise modalities (6A), all targeting the pattern. Typical mix:

- 2–3 rounds of **E2 (oral cloze)** with blanks on the target pattern.
- 2 rounds of **E5 (error spotting)** planting errors involving the target.
- 2 rounds of **E7 (reaction drill)** with lines that invite the target pattern as response.
- Optionally 1–2 rounds of **E1 (active shadowing)** for rhythm/chunk memorization.

Low pressure, high volume. The Master adapts the mix in real time based on moment 2's signal.

**Signal captured:** dense production data on the target pattern in low-stakes contexts. Primary source of evidence for `Master.update_model` after the lesson.

#### 6B.3.4 Moment 4 — Free production (~5 min)

A single larger exercise that **forces** the target pattern in authentic use. Typically:

- **E6 (open-ended narrative continuation)** with a prompt that requires the pattern — e.g. for past continuous, *"Start like this: 'It was a Tuesday afternoon, and I was walking home when…'"*, or
- A short **live-roleplay** (1–2 min) with a scenario that makes the pattern structurally necessary.

The context is drawn from `engagement_profile.themes_that_land` to sustain engagement in this longer segment.

**Signal captured:** whether the student transfers the pattern to authentic, sustained production — the ultimate goal.

#### 6B.3.5 Moment 5 — Consolidation (~2 min)

The Master closes the lesson by callback-looping to moment 1:

> *"Lembra quando eu perguntei no começo o que você tava fazendo ontem? Tenta de novo agora."*

The student responds. Typically, production is visibly improved. The Master **names the improvement** — this is the only moment in the lesson where pedagogical intent is explicitly surfaced:

> *"Viu? Você acabou de usar past continuous 14 vezes nessa sessão, sem ter percebido. E agora tá soando natural. Esse padrão foi o que a gente trabalhou."*

This is the **motivational payoff**. It also unmasks the stealth principle — but in a moment that rewards the student rather than burdening them. The revelation, placed at the end, is pedagogically powerful and narratively satisfying.

**Signal captured:** improvement delta from baseline (moment 1) to post-lesson performance. A strong delta signals lesson success; a weak delta signals the lesson failed to land and the Master should either repeat the target from another angle later or defer.

### 6B.4 Generation architecture — the hybrid approach (decided)

Three architectures were considered:

- **A. Pre-composed.** One LLM call generates all 5 moments upfront. Cheap, fast at runtime, not adaptive.
- **B. Fully reactive.** Each moment is generated just-in-time based on the previous moment's signal. Adaptive, but costly, stateful, and introduces latency between moments.
- **C. Hybrid (chosen).** The **lesson skeleton** is pre-composed in one call: the 5 moments' *roles* are fixed, their *thematic thread* is fixed, the *target pattern* is fixed. The **content of each moment** is generated just-in-time, conditioned on the lesson plan plus the performance signal from the previous moment.

Concretely:

1. **`Master.compose_lesson(learner_model, trigger) → LessonPlan`** runs once when the lesson is offered/accepted.
   Output: the plan — title (thematic), target pattern, 5 moment definitions (each with role, duration estimate, adaptation rules), engagement context, expected difficulty curve.
2. **`Master.render_moment(lesson_plan, moment_index, previous_signal) → MomentContent`** runs per moment during the lesson.
   Output: the actual generated content for that moment (the hook line, the noticing examples, the drill mix, the narrative prompt, the consolidation callback).

This keeps the cost bounded while preserving enough adaptivity for the lesson to feel authored for the student. If the student crushes moment 2, moment 3 starts harder. If moment 3 reveals a neighboring error (e.g. article omission while producing past continuous), the Master notes it for the post-lesson update but does **not** redirect the lesson — one lesson teaches one thing.

### 6B.5 Triggers — when the Master offers a Lesson

Lessons are **not imposed**. The Master evaluates lesson candidacy after each session and may offer one. Trigger conditions (any of):

- A `chronic_error` has crossed a threshold (default: 5 occurrences across ≥3 sessions without resolution).
- An `acquiring` pattern is **stuck** (default: 3 teaching attempts without promotion to mastered, success rate plateaued).
- A **breakthrough opportunity**: the student is one pattern away from crossing a CEFR threshold (e.g. B1+ needs past continuous consolidation to move to B2; the Master detects proximity).
- A **cadence trigger**: ≥7 days since the last lesson, to keep the modality visible.

Only one trigger at a time produces an offer. Priority: chronic > stuck > breakthrough > cadence.

**Frequency caps.** Maximum 2–3 lessons per week per user. Minimum 48h between lessons. These protect against the app feeling like a course rather than a practice tool.

**Acceptance.** When offered, the student sees an unobtrusive card on the Practice Hub: *"O Mestre sugere uma prática focada: '<thematic title>', ~15 min."* Accept, dismiss ("not now"), or mute for a week. Dismiss/mute are recorded in the `LearnerModel` to adjust future offers.

### 6B.6 The only moment of visibility — and why it does not break D-1

Decision D-1 says the Master is silent. A Lesson, by existing, means the Master is momentarily visible. This is a deliberate, bounded exception:

- The Master is visible only **at the Lesson offer** and **during the Lesson**, never during normal exercise or review flow.
- Even within the Lesson, the Master only **names itself and its intent** at moment 5 (consolidation). Moments 1–4 are still stealth within the lesson's thematic frame.
- The student can opt out of Lessons globally (settings toggle), in which case the Master continues silently driving normal exercises forever and never surfaces.

This preserves D-1 as a default posture (silent Master) while allowing the controlled exception that enables the Lesson modality.

### 6B.7 Post-lesson processing (Master.update_model with boost)

After moment 5, `Master.update_model` runs with a `lesson_boost: true` flag. Effects:

- Evidence from the lesson counts extra toward promotion thresholds (typical rounds of practice give +1 evidence; a lesson round gives +2).
- The delta between moment 1 baseline and moment 5 performance is recorded as a `breakthrough_event` in `learner_model_history` for future analysis.
- The next 48h of prescribed exercises reinforce the lesson's target pattern in varied contexts (consolidation wave) — without labeling it, of course.
- If the lesson underperformed (weak delta, signs of frustration), the target pattern is marked as `hard_for_user` and deferred; the Master will not retry for at least 14 days, and when it does retry it will approach from a different angle.

---

## 7. Feature catalogue

This is the implementation-facing list. Each item is a discrete feature. Ordering is by dependency, not priority.

### 7.1 Foundation features (must exist before any Master feature)

**F1. Evaluation prompt v2 — emits 5D scores, canonical patterns, and severities.**
- Modify `getEvaluationPrompt` and `evaluationResponseSchema` in `src/utils/prompts.ts`.
- Modify `EvaluationResult` and `CorrectionItem` in `src/types/card.ts`.
- Add backward-compat shim: when reading old cards, synthesize 5D scores from the legacy single score.
- Acceptance: running evaluation returns the new schema; legacy cards still render; `guessCategory()` is unused.

**F2. Canonical pattern registry.**
- New file `src/services/patterns.ts` exporting `KNOWN_PATTERNS` enum-like structure.
- Expose helpers: `isKnownPattern(id)`, `patternMetadata(id) → { category, human_label_pt, typical_contexts }`.
- Acceptance: a dev can import the registry and get a >50 pattern starter vocabulary.

**F3. errorAnalysis rewrite on canonical patterns.**
- Delete `guessCategory` and the 30-char `patternId` hack.
- `pattern_key` column in `error_patterns` now stores `canonical_pattern` directly.
- Migration: collapse duplicates in existing rows using best-effort mapping; preserve occurrence counts.
- `identifyWeakAreas` and dashboard queries unchanged in interface but now statistically meaningful.
- Acceptance: running the same error across 3 sessions increments a single row to `occurrences: 3`.

**F4. Effective tone resolver.**
- New helper `getEffectiveTone(context) → ConversationTone` in `src/services/tone.ts`.
- Callers: `getEvaluationPrompt` consumers, scenario evaluation, live analysis.
- Acceptance: a formal-roleplay exercise evaluates with formal tone even if user's global setting is `casual`.

### 7.2 Student-facing surface features

**F5. 5D scorecard component.**
- New `src/components/shared/ScorecardDisplay.tsx`.
- Replaces `ScoreDisplay` inside `EvaluationResults`.
- Acceptance: renders 5 bars + primary_dimension callout; passes a11y check.

**F6. Feedback-as-practice drill.**
- New `src/components/shared/FeedbackDrill.tsx`.
- Three states: show, diff, record.
- Integrated before `EvaluationResults` in `ExerciseMode`.
- Has "skip to full feedback" escape.
- Acceptance: after evaluation, student sees drill first; can skip; drill produces a second micro-evaluation that updates `LearnerModel` (if Master active).

**F7. On-demand correction explanation.**
- Wire `getTutorExplanationPrompt` to a "Por quê?" button in each `CorrectionItem` row.
- Stream response inline, collapsed by default.
- Acceptance: clicking the button produces a ~4-sentence coaching explanation in Portuguese with English examples.

**F8. Corrections ranked by `next_step_plan` relevance (Master-aware).**
- When `Master.evaluate` returns a `relevant_correction_ids` array, `EvaluationResults` highlights those and collapses the rest.
- When Master is inactive, behaves as today.
- Acceptance: with Master active and a `past_continuous` goal, a past-continuous correction is always surfaced first.

### 7.3 The Master — core

**F9. `LearnerModel` schema + table + RLS.**
- New Supabase migration: `learner_models` table.
- RLS: user can select/update only own row.
- Companion table `learner_model_history` for auditing patches.
- Acceptance: migration applies cleanly; RLS verified with two test users.

**F10. Patch protocol & applier.**
- New `src/services/learnerModel.ts`.
- Exports: `loadLearnerModel(user_id)`, `applyPatches(model, patches) → model`, `savePatchedModel`, `logPatches`.
- Closed enum of valid ops (see 5.3). Unknown ops logged, not applied.
- Acceptance: applying a valid patch sequence produces expected model; invalid op is logged and ignored; history row is written.

**F11. `Master.prescribe` — prompt + function.**
- New `src/services/master/prescribe.ts`.
- Input: `LearnerModel`, requested exercise type, user-selected theme (if any).
- Output: `Briefing` JSON matching a strict schema.
- Uses a small/cheap LLM (cost-optimized).
- Acceptance: given a model with goal `past_continuous`, produces briefing whose `target_skill` contains `past_continuous`; disguise theme is one of `engagement_profile.themes_that_land`.

**F12. Generator prompts accept a Briefing.**
- Extend `getPhraseGenerationPrompt`, `getTextGenerationPrompt`, `getRoleplayGenerationPrompt` to accept an optional `briefing` arg.
- When provided, inject it into the prompt as a constraints block.
- Preserve stealth principle: the briefing never leaks into output.
- Acceptance: generating a phrase with a briefing targeting `past_continuous` + theme `food` produces a Portuguese phrase whose natural translation requires past continuous and references food.

**F13. `Master.evaluate` — prompt + function.**
- New `src/services/master/evaluate.ts`.
- Input: `LearnerModel`, `EvaluationResult`, original `Briefing`.
- Output: `MetaAssessment` JSON (goal met, unexpected errors, engagement signal, relevant correction IDs, recommendation).
- Acceptance: for a session where student used past continuous correctly, returns `goal_met: true` and recommends advancing.

**F14. `Master.update_model` — prompt + function + applier.**
- New `src/services/master/update.ts`.
- Input: `LearnerModel`, `MetaAssessment`.
- Output: `patches[]` using the closed op enum.
- Runs async after the student sees feedback (does not block UI).
- Applied via F10.
- Acceptance: three consecutive correct uses of a pattern promote it to `mastered`.

**F15. Master orchestrator integration into `ExerciseMode`.**
- On "Generate exercise": call `prescribe` → pass briefing to generator.
- On evaluation complete: call `evaluate` → use its output for F8 filtering → queue `update_model` async.
- Feature-flagged: when the flag is off, behaves exactly as today.
- Acceptance: full round-trip exercise works with Master active; disabling the flag reverts to current behavior.

**F16. Master orchestrator integration into live roleplay.**
- Scenario generation calls `prescribe` to constrain `systemDetails` and opening.
- `ConversationAnalysis` calls `evaluate` + `update_model` on finish.
- Acceptance: live roleplay scenarios start tilting toward patterns in the student's `next_step_plan` without obvious pedagogical labels.

**F17. Master-driven review card selection.**
- Replace/augment `getCardsForWeakArea` and `getPrioritizedReviewCards` in `errorAnalysis.ts`.
- New priority: cards whose latest evaluation includes `canonical_pattern`s present in `next_step_plan` or `chronic_errors`.
- Fallback to current SM-2 ordering when no match.
- Acceptance: opening Review surfaces cards aligned to current plan, while still respecting SRS schedule.

**F18. Cold-start diagnostic mode.**
- Flag in `LearnerModel`: when `cefr_estimate.confidence < 0.6`, `prescribe` uses a diagnostic prompt variant (wide variety, calibration probes).
- After N sessions or confidence threshold, flips to normal mode.
- Acceptance: new user's first 3 sessions span varied difficulty/topics; by session 4–5 the plan crystallizes.

### 7.4 Operational & safety features

**F19. Master feature flag + kill switch.**
- Config flag `VITE_MASTER_ENABLED` + per-user override in `profiles`.
- When off: all Master calls short-circuit and system behaves exactly as today.
- Acceptance: disabling the flag mid-session causes no crashes; next exercise is generated without briefing.

**F20. Master cost controls.**
- `prescribe` uses a small model (e.g. GPT-4o-mini or Gemini Flash).
- `update_model` runs async, can be batched per session.
- Briefing cached for the duration of a session (same briefing reused if student generates multiple exercises of the same type without closing the hub).
- Telemetry: tokens per mode logged to a `master_usage` table for monitoring.
- Acceptance: p95 added latency per exercise <800ms; per-session Master token spend documented.

**F21. Frustration detection → plan recalibration.**
- Simple heuristic (v1): 3 consecutive sessions with `goal_met: false` OR average primary_dimension < 40 OR session abandonment rate increase → `Master.update_model` receives `frustration_signal: high` and next `prescribe` is instructed to step back.
- Acceptance: synthetic frustration trace produces a plan where `primary_goal` regresses or widens.

**F22. Manual `LearnerModel` reset.**
- Settings page action "Resetar meu tutor" with confirmation.
- Clears the row, writes a reset event to history.
- Acceptance: after reset, next session runs in diagnostic mode.

### 7.5 New exercise modalities (see section 6A)

Each feature here corresponds to one modality (E1–E8) from section 6A. All accept an optional Master `Briefing`. All emit an `EvaluationResult` (or modality-specific analogue) that feeds the `LearnerModel`.

**F23. E1 — Active Shadowing.**
- New `src/components/exercises/ActiveShadowing.tsx` + a shadowing-specific evaluation path.
- v1 scope: word-level accuracy + timing alignment via STT + duration comparison.
- v2 scope (gated on D1): pitch contour comparison, prosody delta.
- New prompt helper `getShadowingLinePrompt(briefing)` for generating lines to shadow.
- Acceptance: student hears a native line, speaks back, receives a per-word accuracy breakdown and an aggregate timing score; emits a canonical-pattern-tagged micro-evaluation.

**F24. E2 — Oral Cloze.**
- New `src/components/exercises/OralCloze.tsx`.
- New prompt helper `getOralClozePrompt(briefing)` producing `{sentence_with_blank, target_token, target_pattern}`.
- Evaluation is near-instant: compare spoken token to target with STT + normalization; Master attaches `canonical_pattern` from the generation phase.
- Acceptance: 10 rounds in ≤3 min; per-round correctness + aggregate pattern-level accuracy; the LLM cost per round is minimal.

**F25. E3 — Directed Listening.**
- New `src/components/exercises/DirectedListening.tsx`.
- New prompt helper `getListeningPassagePrompt(briefing)` producing `{passage, comprehension_questions[], expected_key_points[]}`.
- TTS plays the passage; student answers 2–3 questions by voice; LLM judges answers against `expected_key_points`.
- Acceptance: passage of 30–60s plays once (with optional single replay), student answers produce a full `EvaluationResult` plus a comprehension score.

**F26. E4 — Reformulation.**
- New `src/components/exercises/Reformulation.tsx`.
- New prompt helper `getReformulationPrompt(source, target_style, briefing)` where `target_style ∈ { 'more_casual', 'more_formal', 'shorter', 'more_natural' }`.
- Source may be a prior `userTranscription` flagged by the Master as stiff, or a fresh generated one.
- Evaluation emphasizes pragmatics + naturalness dimensions.
- Acceptance: student hears/reads source, speaks reformulation, receives feedback that highlights register shift quality.

**F27. E5 — Error Spotting.**
- New `src/components/exercises/ErrorSpotting.tsx`.
- New prompt helper `getErrorSpottingPrompt(target_pattern, briefing)` producing `{sentence_with_planted_error, error_description, correction}`.
- Student hears the sentence, speaks the corrected version; system compares spoken output to `correction` via STT + semantic equivalence check.
- Acceptance: 5–10 rounds; per-round correct/incorrect identification + quality of the stated correction; integrates with `chronic_errors` from the `LearnerModel`.

**F28. E6 — Open-Ended Narrative.**
- New `src/components/exercises/NarrativeContinuation.tsx`.
- New prompt helper `getNarrativeSeedPrompt(briefing)` producing 1–2 opening sentences.
- Student speaks freely for 30–60s; STT transcribes; evaluation emphasizes fluency + cohesion.
- Captures speaking-rate stats (words/min, hesitation count once D1 lands).
- Acceptance: student completes a 60s continuation and receives feedback grounded in the full transcript, not just a short utterance.

**F29. E7 — Reaction Drill.**
- New `src/components/exercises/ReactionDrill.tsx`.
- New prompt helper `getReactionDrillPrompt(briefing)` producing a `lines[]` array of 8–12 short provocations with expected naturalness markers.
- Per round: AI plays line, a 3s timer starts, student must respond; system records latency + the response.
- Evaluation: aggregate "automaticity score" (latency × naturalness), surfaced as a compact summary.
- Acceptance: a full set completes in ≤4 min; latency is measured; responses are batch-evaluated.

**F30. E8 — Minimal Pairs & Phonetic Discrimination.**
- **Deferred until D1 lands.** Listed for roadmap completeness.
- When implemented: two-audio comparison UI + production attempt.
- Acceptance: TBD when D1 is in scope.

### 7.6 Lessons (see section 6B)

**F31. Lessons — core feature.**
This is a composite feature that spans data model, Master logic, generation, and UI. Listed as a single F because its parts cannot ship independently; however, each bullet is an identifiable subtask.

- **F31a. Data model.** New Supabase table `lessons` (per-user records with `lesson_plan` JSONB, `status`, `moment_signals` JSONB, `baseline_utterance`, `final_utterance`, `delta_score`, `created_at`, `completed_at`). New table `lesson_offers` tracking offered/accepted/dismissed/muted states to feed frequency caps.
- **F31b. Trigger evaluation.** New `src/services/master/lessonTriggers.ts` running after each session's `update_model`. Returns at most one `LessonCandidate` per evaluation, using priority order: chronic > stuck > breakthrough > cadence. Respects frequency caps (≤2–3/week, ≥48h spacing).
- **F31c. `Master.compose_lesson`.** New `src/services/master/composeLesson.ts`. Input: `LearnerModel`, `LessonCandidate`. Output: a `LessonPlan` — thematic title (never grammatical), target pattern, 5 moment definitions with role + duration + adaptation rules, engagement context, expected difficulty curve.
- **F31d. `Master.render_moment`.** New `src/services/master/renderMoment.ts`. Input: `LessonPlan`, `moment_index`, `previous_signal`. Output: concrete content for that moment (hook line, noticing examples, drill mix, narrative seed, or consolidation callback).
- **F31e. Lesson runtime UI.** New `src/components/lesson/LessonPage.tsx` orchestrating the 5 moments. Reuses exercise components from F23–F29 for moment 3's drill mix and moment 4's production. Progress indicator shows *moments*, not minutes, to preserve narrative pacing.
- **F31f. Offer UI in Practice Hub.** Unobtrusive card on `PracticeHubPage.tsx` when a `LessonCandidate` is available. Accept / "not now" / mute-for-a-week, all persisted.
- **F31g. Post-lesson update with boost.** Extend `Master.update_model` to accept a `lesson_boost: true` flag; evidence from the lesson counts +2 per round; delta (baseline → final) is recorded in `learner_model_history` as `breakthrough_event`.
- **F31h. Consolidation wave.** For 48h after a lesson, `Master.prescribe` biases toward varied contexts for the same target pattern (never named). Implemented as a flag on the `LearnerModel`'s `next_step_plan`.
- **F31i. Global opt-out.** Settings toggle "Oferecer práticas focadas do Mestre (recomendado)". When off, no offers are made; the Master continues driving normal exercises silently.

Acceptance (end-to-end): a student with a planted chronic error receives an offer within one session of crossing the threshold; accepting produces a 12–18 min lesson with a thematic title, 5 distinct moments, and a post-lesson state where the `LearnerModel` shows a measurable delta on the target pattern.

### 7.7 Explicitly deferred (not v1, but preserved for memory)

- **D1. Pronunciation and prosody feedback** — requires Web Audio + pitch contour + phoneme alignment. High impact, high complexity. Unlocks E8 (F30) and upgrades E1 (F23) to v2. Sits on top of the Master once it exists.
- **D2. Persona-shadow (voice cloning of the student's ideal native self)** — transformative but expensive and ethically loaded. Defer.
- **D3. Visible Master interface** — conversational "tutor tab" for explicit Q&A with the Master outside of Lessons. Deliberately deferred per product decision (see section 9). Lessons (F31) already provide the controlled, bounded visibility of the Master; a full conversational tab remains future work.
- **D4. Community-anonymous comparison** — "77% of B2 students make this mistake". Requires privacy work and a large enough user base.
- **D5. NPC in-character reactions to stiffness** — great for engagement but complicates roleplay prompt design. Future milestone.
- **D6. Student-initiated Lesson requests** — a future "pede uma prática sobre X" entry point, bypassing the trigger system. Requires a safe way to accept student topics without the Master being forced into bad pedagogical choices. Defer until lesson mechanics are validated via the automatic-trigger path.

---

## 8. User journey with the Master active (end-to-end example)

This is a narrative walkthrough to make the abstract concrete. It is the same app the user sees today, but under the hood every step is different.

**Session 12 of user Maria (B1+, target B2).**

Maria's `LearnerModel` says:
- Mastered: present simple, simple past, basic modals.
- Acquiring: past continuous (success rate 0.65, 7 attempts).
- Chronic: drops "the" before generic plurals; uses latinate verbs instead of phrasal verbs.
- Engagement: loves food/travel, flops on business.
- Next step plan: "consolidate past continuous in narrative interruption; indirect phrasal verb exposure".

1. Maria opens Practice → Phrase exercise → theme "food".
2. `Master.prescribe` receives the model + request. Returns briefing: `target_skill: past_continuous`, `secondary: phrasal_verb_exposure`, `disguise_theme: food`, `required_elements: [narrative, interruption]`, `forbidden_elements: [formal register]`, `success_criteria: "uses was/were -ing + past simple naturally; bonus if uses a phrasal verb"`, `expected_difficulty: slight_stretch`.
3. Generator prompt gets the briefing. Produces: *"Ontem, eu estava preparando um jantar especial quando meu amigo apareceu com uma notícia que me deixou de queixo caído."* (Natural translation requires past continuous + `show up` phrasal verb.)
4. Maria records her attempt: *"Yesterday, I was preparing a special dinner when my friend came with news that left me surprised."*
5. Normal evaluation runs. Scores (5D): `{naturalness: 72, accuracy: 85, fluency: 70, pragmatics: 80, completeness: 85}`. Corrections include `{canonical_pattern: "phrasal_verb_avoidance:show_up", tip: "Mais natural dizer 'showed up' em vez de 'came'", severity: "polish"}` and `{canonical_pattern: "idiom_vs_literal", tip: "'My jaw dropped' é mais vivo que 'left me surprised'", severity: "moderate"}`.
6. `Master.evaluate` reads the result. Past continuous was used correctly — `goal_met: true`. Phrasal verb was avoided — `avoidance_confirmed: true`. Relevant corrections: the `show_up` one (matches plan). Recommendation: advance primary, keep phrasal exposure.
7. **Maria's screen**: drill first ("You said…", diff shows `came` → `showed up`, she repeats). Then the full evaluation surface appears with the `show_up` correction at the top. Other corrections collapsed as "more details".
8. Async: `Master.update_model` emits patches: increment past_continuous attempts (now 8, success 0.7); add a new acquiring pattern `phrasal_verb:show_up`; note engagement high; rewrite `next_step_plan` → "start promoting past continuous toward mastery (needs 3 more clean uses); begin active phrasal verb introduction".
9. Next time Maria opens the Review screen, the card selector finds cards with `canonical_pattern` matching `past_continuous` or `phrasal_verb_avoidance` and surfaces those first.
10. Maria never sees any of this.

---

## 9. Decisions taken

These are final for v1 unless revisited explicitly.

### D-1. The Master is **silent** for v1.

No UI surface, no "tutor tab", no explicit messaging outside of the controlled Lesson exception (see D-11). The student interacts with the app exactly as today; every change is under the hood. Rationale: validate the pedagogical mechanism before adding conversational surface. A fully visible Master (standalone conversational tab) remains a future milestone (deferred as D3 in 7.7).

### D-2. Feedback is **practice**, not a report.

The default post-evaluation flow is the drill (F6). The detailed report is available but secondary. Rationale: the app's promise is spoken English; reading is a lower-value mode; immediate repetition under correction is pedagogically stronger.

### D-3. Curriculum is **hybrid** (structured skeleton + responsive plan).

The Master operates on top of a CEFR-anchored skeleton (A2 → B1 → B2 → C1) with published descriptor lists as references. The `LearnerModel.next_step_plan` is free to skip, revisit, or stall on specific pieces based on observed student state — but there is always a coherent trajectory, not pure session-to-session reactivity. Rationale: pure responsiveness risks leaving gaps; pure prescriptiveness ignores the individual. Hybrid captures the strengths of both and mirrors how good human tutors actually work.

### D-4. `LearnerModel` updates use **patches**, not regeneration.

See 5.3. Rationale: long-term schema stability, auditability, safe rollback.

### D-5. Evaluation emits **canonical patterns**; regex categorization is **deleted**.

See 6.2 and F1/F3. Rationale: the current regex is structurally broken and poisons all downstream analysis.

### D-6. Single-score UI is **replaced** by 5D scorecard.

See 6.1 and F5. Legacy single score is computed from 5D for backward compat but is no longer the source of truth.

### D-7. Tone becomes **contextual**, not global.

See 6.6 and F4. Global setting remains as fallback; scenario/exercise-specific tone overrides it when relevant.

### D-8. Exercise catalogue is **expanded** with 8 new modalities.

See section 6A. Features F23–F30. E8 (phonetic discrimination) is gated on D1 and deferred; the remaining 7 are in scope for v1. Rationale: the current catalogue is all synchronous solo production and leaves major pedagogical territories (listening, shadowing with comparison, reformulation, sustained fluency, reaction automaticity, error noticing, cloze) uncovered. The Master cannot meaningfully prescribe without a rich enough palette.

### D-9. Lessons are **in scope** for v1.

See section 6B. Feature F31. The Lesson feature is part of v1 rather than a future milestone, because without Lessons the Master cannot address chronic errors or provide a sense of progression — both identified as first-class needs in the conversation that produced this document. Lessons are introduced with a thematic, opt-in surface and frequency caps to manage risk.

### D-10. Lesson generation uses the **hybrid architecture**.

See 6B.4. Skeleton pre-composed in one call; each moment's content rendered just-in-time conditioned on the previous moment's signal. Rationale: pure pre-composition sacrifices adaptivity (lessons feel canned); fully reactive generation multiplies cost and latency without proportional benefit. The hybrid captures ~80% of the adaptivity value at ~40% of the cost.

### D-11. Lesson titles are **always thematic**, never grammatical.

See 6B.2 (P2). The pedagogical target is named only in moment 5 (consolidation) as a motivational payoff. This is the bounded exception to D-1; outside of Lessons, the Master remains fully silent.

### D-12. The Master **chooses the modality**, not just the content.

See 6A.3. `Master.prescribe` returns both a `modality_choice` (which of the 7+ exercise types fits the current goal) and the briefing for that modality. Rationale: matching modality to goal is itself a pedagogical skill. A chronic preposition error is better attacked by an oral cloze than by a phrase exercise; automaticity is better trained by a reaction drill than by a narrative. Forcing the Master to use a single modality wastes the expanded catalogue.

---

## 10. Open questions

These must be resolved before or during implementation. Resolving them should update this document.

### Q-1. What exact set of canonical patterns ships in v1?

A list of ~50 is needed. Must balance: breadth (covers common B1/B2 phenomena), granularity (not too abstract like "grammar", not too narrow like "article with 'the' before 'Brazilians' on Tuesdays"), L1-awareness (captures Portuguese-specific interference patterns).

Deliverable: `src/services/patterns.ts` with the starter list, documented, open to expansion.

### Q-2. What model(s) power each Master role?

- `prescribe` — lightweight, structured output, low latency. Candidates: GPT-4o-mini, Gemini 2.0 Flash.
- `evaluate` — same or equivalent.
- `update_model` — can be larger/slower since async. Candidate: GPT-4o or equivalent for reliability of the patch protocol.

Actual choice depends on cost tests and existing provider routing in `src/services/openai.ts` / `geminiLive.ts`.

### Q-3. Diagnostic mode exit criteria — concrete thresholds?

Proposal: exit when (`confidence >= 0.6`) OR (`sessions_since_creation >= 5 AND confidence >= 0.4`). Needs calibration once running.

### Q-4. What counts as a "session" for frustration detection?

A completed exercise? A practice hub visit? A calendar day? Proposal: a completed exercise counts; 3 consecutive with `goal_met: false` triggers recalibration. Tunable.

### Q-5. How do we handle the migration of existing `error_patterns` rows?

Options:
- (a) Best-effort map legacy `pattern_key` (30-char text) to a canonical pattern via a one-time LLM pass.
- (b) Freeze legacy rows and start fresh.
- (c) Hybrid: preserve row counts but mark as `legacy: true`, do not use in Master logic.

Recommended: (c). Keeps the dashboard history for nostalgic/continuity reasons, prevents legacy noise from polluting the Master.

### Q-6. Feature flag granularity?

Global env flag is a minimum. Per-user flag in `profiles` lets us canary and roll forward/back. Per-feature flags (e.g., enable Master for generation but not yet for review) may be useful during staged rollout.

### Q-7. Telemetry & evaluation of the Master itself — how do we know it's working?

Needs explicit outcome metrics. Candidates:
- Proportion of sessions where `goal_met: true`.
- Rate of `mastered` promotions per week.
- CEFR confidence drift per user.
- User retention / session length vs. baseline (A/B).

A `master_telemetry` spec should accompany F19/F20.

### Q-8. Privacy / compliance on the `LearnerModel`?

It's pedagogical metadata, not PII-heavy, but it is a model of a person. RLS is necessary but probably not sufficient long-term. Needs a short privacy review before production release.

### Q-9. Lesson validation gate — when do we ship F31?

Lessons are the most expensive feature in this document (see R-8). They should ship only after a minimal validation loop. Proposal:

- (a) Ship F23–F29 (new exercise modalities) first and run for ≥2 weeks with at least a small cohort of users.
- (b) Simultaneously, ship the Lesson trigger evaluator (F31b) in **dry-run mode**: it writes candidates to `lesson_offers` with `status: 'would_offer'` but never surfaces them.
- (c) Review candidates qualitatively: are the triggers firing at reasonable moments? Are the chosen target patterns plausible? Is frequency sane?
- (d) Only after (c) passes do we ship F31c onward (composition, rendering, runtime, offer UI).

This staged rollout means the Lesson *mechanics* are validated before the Lesson *user experience* is built.

### Q-10. Which exercise modalities ship in wave 1 vs wave 2?

Features F23–F29 are all in v1 scope, but can be phased. Proposal:

- **Wave 1** (highest Master signal-to-cost): F24 (oral cloze), F27 (error spotting), F29 (reaction drill). These are short, high-volume, and give the Master the densest data fastest.
- **Wave 2** (higher production-quality, longer exercises): F23 (active shadowing), F26 (reformulation), F28 (open-ended narrative).
- **Wave 3** (listening-focused, higher implementation complexity): F25 (directed listening).

Needs confirmation with the product owner once implementation capacity is known.

### Q-11. How are the moment-to-moment Lesson signals structured?

Moment N's signal must be compact enough to include as context in moment N+1's render call without blowing token budgets, and rich enough to genuinely adapt. Proposal: a `MomentSignal` object with `{ goal_met: boolean, difficulty_actual: 'easy'|'ok'|'hard', observed_issues: pattern_id[], notable_successes: pattern_id[], engagement_observed: 'high'|'medium'|'low'|'frustrated' }`. Concrete schema needs a prototyping pass.

---

## 11. Risks & mitigations

**R-1. LLM non-determinism corrupts the `LearnerModel`.**
Mitigated by the patch protocol (5.3) and closed op enum. Unknown ops are logged and ignored.

**R-2. Stealth principle leaks.**
The LLM sometimes narrates its intent ("Let's practice past continuous!"). Prevention: explicit prompt rules forbidding pedagogical labels in generated content; golden tests with regex detectors ("past continuous", "we're practicing", etc.) that fail the generation if present.

**R-3. Added latency per exercise.**
Budget: p95 added latency ≤ 800ms. Achieved by: small model for `prescribe`, caching briefing within a session, async `update_model`.

**R-4. Cost spike.**
Tracked via `master_usage` table. Per-user monthly cap (graceful fallback to non-Master mode when exceeded) is a post-v1 consideration, but the instrumentation for it ships in v1.

**R-5. Overfitting: Master funnels student into the same 3 patterns forever.**
The `next_step_plan` includes a `secondary_goal` and periodic "exploration" prescriptions (every Nth session) that probe breadth. Mitigation validated by telemetry (diversity of patterns touched per week).

**R-6. Cold start is boring / confusing.**
The diagnostic mode is varied enough to *feel* exploratory but may feel "unfocused" to users expecting "lessons". Because the Master is silent (D-1), we cannot tell the user "we're getting to know you". Accepted risk for v1; revisit with telemetry.

**R-7. Migration of legacy error patterns.**
Option (c) in Q-5 avoids this risk entirely. Picked as the working default.

**R-8. Lessons consume months of work before product-market signal.**
Lessons (F31) is the most ambitious feature in this document: data model, two new Master roles, orchestration UI, offer surface, boost logic. If built before F23–F29 ship and generate telemetry, it risks being wrong in ways we cannot detect. Mitigation: the staged rollout in Q-9 (dry-run triggers first, full stack only after ≥2 weeks of exercise-modality data). Additional mitigation: the 5-moment structure is fully specified here so that if the first implementation lands wrong, iteration is bounded to content/UX, not architecture.

**R-9. Lesson didactic drift.**
Even with the thematic-name rule (D-11), LLM content may drift toward textbook tone inside the lesson moments, especially in moment 2 (noticing). Mitigation: golden tests on moment rendering output (forbid grammatical labels in moments 1–4; the consolidation moment 5 is explicitly allowed to name the target). Human review of the first N lessons per target pattern before rolling more broadly.

**R-10. Modality fatigue.**
With 7+ modalities available, the Master can inadvertently over-rotate and make the app feel erratic. Mitigation: `prescribe` includes "recency of modality choice" as an input and avoids picking the same modality more than ~3 times in a row unless pedagogically required.

**R-11. Reaction drill (E7) feels stressful.**
The 3-second latency window is deliberate but can feel punishing. Mitigation: first few rounds use a 5s window, tighten adaptively; a "practice mode" with no timer is available as a settings opt-in; the feature surfaces an explicit "this is a speed drill, not a grammar test" framing in the intro screen.

---

## 12. Glossary

- **CEFR** — Common European Framework of Reference for Languages. Levels A1/A2/B1/B2/C1/C2.
- **Canonical pattern** — stable string ID for a linguistic phenomenon used across evaluation, analysis, and prescription.
- **Briefing** — structured instruction from `Master.prescribe` to the content generator. In the expanded design, also includes a `modality_choice`.
- **MetaAssessment** — structured output of `Master.evaluate` describing whether the Master's intent for the session was met.
- **Patch** — a typed operation over the `LearnerModel`. One of a closed enum of valid ops.
- **Stealth principle** — the rule that the Master's pedagogical intent is never surfaced in student-facing content (with the bounded Lesson exception per D-11).
- **Zone of proximal development** — pedagogical concept (Vygotsky) that learning is maximized when target difficulty is slightly above current ability.
- **Modality** — a category of exercise (phrase, text, roleplay, image, live-roleplay, review, oral cloze, shadowing, reformulation, …). The Master picks modality as part of prescription (D-12).
- **Exercise** — an atomic practice unit, 30s–3 min. Belongs to exactly one modality.
- **Lesson** — a Master-composed 10–20 min structured pedagogical session with a 5-moment arc (hook → noticing → controlled practice → free production → consolidation). See section 6B.
- **LessonPlan** — the pre-composed skeleton of a Lesson (title, target, 5 moment definitions, engagement context). Output of `Master.compose_lesson`.
- **MomentContent** — the just-in-time rendered content for a specific moment of a Lesson. Output of `Master.render_moment`.
- **MomentSignal** — the compact summary of a moment's outcome, fed into the next moment's render call. See Q-11.
- **Breakthrough event** — a recorded instance of measurable delta between baseline (moment 1) and final (moment 5) performance within a Lesson. Stored in `learner_model_history`.
- **PPP (Presentation-Practice-Production)** — the language-teaching pedagogical framework underpinning the Lesson arc (section 6B.3).

---

## 13. Change log

- **2026-04-20** — initial version. Captures critique, Master vision, `LearnerModel` schema, feature catalogue (F1–F22), and decisions D-1 through D-7. Draft status: ready for product owner review before any implementation begins.
- **2026-04-20 (revision 2)** — major expansion. Adds: (a) section 6A with 8 new exercise modalities (E1–E8) and their Master-aware use; (b) section 6B specifying the Lessons feature end-to-end, including 4 pitfalls, 5-moment anatomy, hybrid generation architecture, trigger system, frequency caps, and post-lesson processing; (c) feature catalogue entries F23–F30 (new modalities) and F31 (Lessons, decomposed into 9 subtasks); (d) decisions D-8 through D-12; (e) open questions Q-9 through Q-11 (staged rollout, wave ordering, moment-signal schema); (f) risks R-8 through R-11 (lesson validation gate, didactic drift, modality fatigue, reaction-drill stress); (g) deferred item D6 (student-initiated lessons) and glossary entries for Modality, Exercise, Lesson, LessonPlan, MomentContent, MomentSignal, Breakthrough event, PPP. Also reframes section 7.5 as new-modality features and renumbers the deferred-items section to 7.7.
