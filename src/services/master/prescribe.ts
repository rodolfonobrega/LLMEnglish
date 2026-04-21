/**
 * Master.prescribe — Wave 5 (F11).
 *
 * Given the current `LearnerModel`, produce a `Briefing` that tells a
 * generator what to target, which modality to use, and under what
 * disguise theme. The Master is silent: the student never sees the
 * briefing; it only reshapes the generated content.
 *
 * Contract:
 *   - No-op (returns `null`) when `masterEnabled()` is false.
 *   - Runs a schema-validated LLM call. Malformed responses → `null`.
 *   - Caches the last briefing per `(userId, requestedExerciseType)` for
 *     10 minutes to avoid spamming the planner when the student restarts
 *     an exercise. Cache is invalidated whenever a new exercise type is
 *     requested.
 *   - Records telemetry (`role: 'prescribe'`) for every call that reaches
 *     the LLM. Cache hits do not emit telemetry.
 *
 * The generated Briefing is the single source of truth for §6.2.2 (the
 * generators read this) and §6.2.3 (the modality router routes to a URL
 * derived from `modality_choice`).
 */

import { chatCompletion } from '../openai';
import { masterEnabled } from '../runtimeConfigSnapshot';
import { recordMasterUsage } from '../masterTelemetry';
import { resolveMasterModel } from './resolveMasterModel';
import { cleanJson } from '../../utils/cleanJson';
import type { Briefing, Modality, SessionIntent } from '../../types/master';
import type { LearnerModel, ReExposureQueueEntry } from '../../types/learnerModel';

const MODALITIES: readonly Modality[] = [
  'phrase',
  'text',
  'roleplay',
  'visual',
  'cloze',
  'spotting',
  'reaction',
  'shadowing',
  'reformulation',
  'narrative',
  'listening',
  'live',
];

export interface PrescribeInput {
  learnerModel: LearnerModel;
  /**
   * If the caller already committed to a specific exercise family
   * (e.g. the student clicked "Frases"), the Master respects it and
   * only chooses target/disguise — modality is fixed.
   */
  requestedExerciseType?: Modality;
  /** Optional theme the student asked for. Overrides engagement-based choice. */
  userTheme?: string;
  /** Recent modality choices (most recent first) to bias diversification. */
  recentModalityChoices?: string[];
  /**
   * Phase 8 (F-P8-02) — the current student `SessionIntent`, if any.
   * Treated as a blending input by `prescribe`. Hard pins are enforced
   * deterministically after the LLM response; soft prefs are passed to
   * the LLM so it can compose around them.
   */
  sessionIntent?: SessionIntent | null;
}

// ---------------------------------------------------------------------------
// Session cache (per §6.2.1)
// ---------------------------------------------------------------------------

interface CacheEntry {
  briefing: Briefing;
  at: number;
  requestedExerciseType: Modality | undefined;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const briefingCache = new Map<string, CacheEntry>();

function cacheKey(userId: string, requestedExerciseType?: Modality): string {
  return `${userId}::${requestedExerciseType ?? 'auto'}`;
}

export function clearPrescribeCache(): void {
  briefingCache.clear();
}

// ---------------------------------------------------------------------------
// LLM plumbing
// ---------------------------------------------------------------------------

const briefingSchema = {
  type: 'object' as const,
  properties: {
    target_skill: {
      type: 'string' as const,
      description: 'Canonical pattern id the exercise must exercise (never user-facing).',
    },
    secondary_skill: { type: 'string' as const, description: 'Optional secondary target.' },
    modality_choice: {
      type: 'string' as const,
      enum: MODALITIES as unknown as string[],
      description: 'Which exercise modality should execute this briefing.',
    },
    disguise_theme: {
      type: 'string' as const,
      description:
        'Thematic wrapper for the content, drawn from engagement_profile.themes_that_land when available.',
    },
    required_elements: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description:
        'Outcome-level constraints the content must contain (phrased as outcomes, not labels).',
    },
    forbidden_elements: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Outcome-level constraints the content must avoid.',
    },
    success_criteria: {
      type: 'string' as const,
      description: 'One-line check the evaluator uses to decide if the goal was met.',
    },
    expected_difficulty: {
      type: 'string' as const,
      enum: ['easy', 'slight_stretch', 'challenge'],
    },
    rationale: {
      type: 'string' as const,
      description: 'Internal reasoning for debugging. NEVER shown to the student.',
    },
    session_size: {
      type: 'string' as const,
      enum: ['standard', 'mini'],
      description:
        "Only meaningful when modality_choice is 'live'. 'mini' = 3-4 turns (default). 'standard' = 6-10 turns, only when a fuller arc is warranted.",
    },
    blend_rationale: {
      type: 'string' as const,
      description:
        'Phase 8 — one-line description of how student SessionIntent was blended with Master priorities. Internal; never shown.',
    },
  },
  required: [
    'target_skill',
    'modality_choice',
    'disguise_theme',
    'required_elements',
    'forbidden_elements',
    'success_criteria',
    'expected_difficulty',
  ],
};

function buildSystemPrompt(): string {
  return `You are the Master, a silent English-learning planner. Given a JSON snapshot of the learner's current state, you MUST output a single JSON object that briefs an exercise generator on what to produce next.

CRITICAL CONTRACT:
- The briefing is internal. The student never sees it. You can use grammatical metalanguage here.
- But the content that the downstream generator produces MUST NOT mention grammatical labels — so phrase "required_elements" as outcome constraints ("the natural English translation must describe an ongoing action that gets interrupted"), NOT as labels ("use past continuous").
- Choose modality_choice from the allowed enum. Prefer diversification when "recent_modality_choices" shows repetition.
- disguise_theme should be drawn from engagement_profile.themes_that_land when non-empty; otherwise pick a neutral, natural-sounding theme (cooking, weekend plans, commuting, pets, sports, etc.).
- THEME DIVERSITY (Phase 2 F-P2-06): if the learner's \`live_fluency_profile.themes_in_window\` shows a dominant theme (>= 40% of the recent window, OR a theme present in every session of the window when there are ≥ 3 sessions), you MUST pick a different disguise_theme. The goal is to keep target_skill the same but force the student to exercise it under a theme that is currently underrepresented. Prefer themes from \`themes_that_land\` that do NOT appear in \`themes_in_window\`.
- success_criteria is a short one-line test that the evaluator will use, e.g. "The student produced at least one clause describing an ongoing action that was interrupted by another event."
- expected_difficulty relative to the learner's current state. In diagnostic_mode, bias toward "slight_stretch" with diversified themes.
- When modality_choice === "live", default to session_size "mini" (3-4 turns). Only emit "standard" when the target_skill plausibly needs a longer arc (narrative, negotiation, multi-step reasoning). Small frequent Live touches compound faster than rare long sessions.
- SESSION INTENT (Phase 8 F-P8-02): if the input includes a non-null \`session_intent\`, honour it with these rules:
  * \`requested_modality\` is a HARD PIN — your \`modality_choice\` MUST equal it.
  * \`requested_vocabulary\` / \`review_focus\` are HARD PINS — thread your target pattern INTO the student's material; never drop or replace it. Add them to \`required_elements\` as outcome constraints.
  * \`requested_theme\` is a SOFT PREFERENCE — set \`disguise_theme\` to it when plausible. Pick a \`target_skill\` that naturally occurs inside that theme.
  * \`requested_pattern\` is a SOFT PREFERENCE — prefer it as \`target_skill\` when it does not clash with Master priorities; otherwise use it as \`secondary_skill\` and explain in \`blend_rationale\`.
  * \`requested_difficulty\`: "easier" → expected_difficulty "easy"; "normal" → "slight_stretch"; "harder" → "challenge".
  * Fill a one-line \`blend_rationale\` describing how you weaved Master's priorities into student intent (internal, never shown).
- Output STRICT JSON. No prose outside the JSON. No code fences.`;
}

function buildUserMessage(input: PrescribeInput): string {
  const { learnerModel, requestedExerciseType, userTheme, recentModalityChoices, sessionIntent } = input;

  const compact = {
    cefr_estimate: learnerModel.cefr_estimate,
    mastered_patterns: learnerModel.mastered_patterns.slice(0, 20),
    acquiring_patterns: learnerModel.acquiring_patterns
      .slice(0, 10)
      .map((p) => ({
        id: p.id,
        success_rate: p.success_rate,
        attempts: p.attempts,
        hypothesis: p.hypothesis,
      })),
    chronic_errors: learnerModel.chronic_errors.slice(0, 10).map((p) => ({
      id: p.id,
      occurrences: p.occurrences,
      teaching_attempts: p.teaching_attempts,
      hypothesis: p.hypothesis,
    })),
    strengths: learnerModel.strengths.slice(0, 5),
    engagement_profile: learnerModel.engagement_profile,
    next_step_plan: learnerModel.next_step_plan,
    diagnostic_mode: learnerModel.diagnostic_mode,
    confidence: learnerModel.confidence,
    // Phase 2 (F-P2-06) — theme diversity anchor for Live.
    live_fluency_profile: learnerModel.live_fluency_profile
      ? {
          sessions_considered_count: learnerModel.live_fluency_profile.sessions_considered.length,
          distinct_themes_in_window: learnerModel.live_fluency_profile.distinct_themes_in_window,
          themes_in_window: learnerModel.live_fluency_profile.themes_in_window,
          trajectory: learnerModel.live_fluency_profile.trajectory,
        }
      : null,
  };

  const intentBlock = sessionIntent
    ? {
        requested_theme: sessionIntent.requested_theme,
        requested_vocabulary: sessionIntent.requested_vocabulary,
        requested_pattern: sessionIntent.requested_pattern,
        requested_modality: sessionIntent.requested_modality,
        requested_difficulty: sessionIntent.requested_difficulty,
        review_focus: sessionIntent.review_focus,
        note: sessionIntent.note,
        quick_practice: sessionIntent.quick_practice ?? false,
      }
    : null;

  return `learner_model:
${JSON.stringify(compact, null, 2)}

requested_exercise_type: ${requestedExerciseType ?? 'auto'}
user_theme: ${userTheme ?? 'none'}
recent_modality_choices: ${JSON.stringify(recentModalityChoices ?? [])}

session_intent: ${intentBlock ? JSON.stringify(intentBlock, null, 2) : 'none'}

Produce the next briefing as a single JSON object per the schema.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Synthesize the next briefing for this learner.
 * Returns `null` when the Master is disabled or the call fails.
 *
 * `userId` is required to namespace the session cache. In anonymous
 * contexts pass a stable string (e.g. `'anon'`).
 */
export async function prescribe(
  userId: string,
  input: PrescribeInput,
): Promise<Briefing | null> {
  if (!masterEnabled()) return null;

  const key = cacheKey(userId, input.requestedExerciseType);
  const cached = briefingCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.briefing;
  }

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(input);

  const resolved = resolveMasterModel('prescribe');
  const started = Date.now();
  let raw: string;
  try {
    raw = await chatCompletion(
      systemPrompt,
      userMessage,
      { model: resolved.model, source: resolved.source },
      briefingSchema,
    );
  } catch (err) {
    console.warn('[Master.prescribe] LLM call failed, falling back to null:', err);
    return null;
  }

  const latencyMs = Date.now() - started;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson(raw));
  } catch (err) {
    console.warn('[Master.prescribe] Malformed JSON, discarding:', err);
    return null;
  }

  let briefing = coerceBriefing(parsed);
  if (!briefing) {
    console.warn('[Master.prescribe] Schema mismatch, discarding');
    return null;
  }

  // Forbid reusing the modality if caller constrained it.
  if (input.requestedExerciseType && briefing.modality_choice !== input.requestedExerciseType) {
    briefing.modality_choice = input.requestedExerciseType;
  }

  // Phase 8 (F-P8-02) — enforce hard pins from the SessionIntent
  // deterministically, so even a misbehaving LLM cannot override the
  // student's declared preferences.
  const intent = input.sessionIntent ?? null;
  if (intent) {
    briefing = applySessionIntentPins(briefing, intent);
    if (intent.quick_practice) briefing.quick_practice = true;
  }

  // Phase 2 (F-P2-05) — default Live sessions to `mini`. The Master
  // philosophy is "many small lives, not few big ones"; explicitly long
  // sessions must be requested by the caller (or in future, by the LLM
  // via a `session_size` field in the schema).
  if (briefing.modality_choice === 'live' && !briefing.session_size) {
    briefing.session_size = 'mini';
  }

  // Phase 2 (F-P2-06) — theme diversity guard. Even when the LLM ignores
  // the diversity instruction above, enforce the rule locally by
  // rewriting `disguise_theme` to an underrepresented alternative when a
  // dominant theme is detected in the recent Live window.
  if (briefing.modality_choice === 'live') {
    const alternative = pickDiverseTheme(briefing.disguise_theme, input.learnerModel);
    if (alternative && alternative !== briefing.disguise_theme) {
      briefing.rationale =
        (briefing.rationale ? briefing.rationale + ' ' : '') +
        `[theme_diversity] rerouted from "${briefing.disguise_theme}" to "${alternative}" (dominant in live window).`;
      briefing.disguise_theme = alternative;
    }
  }

  // Wave 6 Stage B — consolidation wave. While `next_step_plan.consolidation_until`
  // is in the future, pin target_skill to that pattern and vary contexts.
  const consolidationUntil = input.learnerModel.next_step_plan.consolidation_until;
  if (consolidationUntil) {
    const ts = Date.parse(consolidationUntil);
    if (Number.isFinite(ts) && ts > Date.now()) {
      briefing.target_skill = input.learnerModel.next_step_plan.primary_goal;
      briefing.rationale =
        (briefing.rationale ? briefing.rationale + ' ' : '') +
        `[consolidation_until=${consolidationUntil}] varying contexts for the same pattern.`;
    }
  }

  // Wave 6 Stage B — `hard_for_user` back-off. If the LLM chose a pattern
  // that's currently blacklisted with a future `next_retry_at`, fall back
  // to the next_step_plan.primary_goal (or leave it untouched if that is
  // also blacklisted — better to be honest than to thrash).
  const blacklisted = (input.learnerModel.hard_for_user ?? []).filter((e) => {
    const t = Date.parse(e.next_retry_at);
    return Number.isFinite(t) && t > Date.now();
  });
  if (blacklisted.some((e) => e.id === briefing.target_skill)) {
    const fallback = input.learnerModel.next_step_plan.primary_goal;
    if (fallback && !blacklisted.some((e) => e.id === fallback)) {
      briefing.target_skill = fallback;
      briefing.rationale =
        (briefing.rationale ? briefing.rationale + ' ' : '') +
        `[hard_for_user] rerouted away from blacklisted pattern.`;
    }
  }

  // Phase 7 (F-P7-03) — scheduled re-exposure takes priority over whatever
  // the LLM picked. If there is a due probe in `re_exposure_queue`, honour
  // it: pin `target_skill` to the probe's pattern, switch `modality_choice`
  // to the probe's modality (Live-biased by default), and mark the briefing
  // so the evaluator logs a `ReExposureCheck`. The probe is picked FIFO
  // (earliest `due_at` first). The entry is not dequeued here — it is
  // dequeued when the surface actually evaluates the attempt (so that a
  // cached briefing can still be consumed without losing the probe).
  // Phase 8 (F-P8-04) — when the student declared `quick_practice`, skip
  // scheduled re-exposure probes. The probe stays in the queue; it will be
  // picked up on the next non-quick session. "Quick" is a deliberate,
  // student-owned escape valve.
  const dueProbe = intent?.quick_practice ? null : pickDueReExposure(input.learnerModel);
  if (dueProbe && !blacklisted.some((e) => e.id === dueProbe.pattern_id)) {
    briefing.target_skill = dueProbe.pattern_id;
    const probeModality = toBriefingModality(dueProbe.preferred_modality);
    if (probeModality) briefing.modality_choice = probeModality;
    briefing.expected_difficulty = 'slight_stretch';
    briefing.rationale =
      (briefing.rationale ? briefing.rationale + ' ' : '') +
      `[re_exposure] honoring scheduled probe for ${dueProbe.pattern_id} (scheduled_for=${dueProbe.scheduled_for}).`;
    if (probeModality === 'live') {
      briefing.session_size = 'mini';
    }
    // Honour `preferred_theme_exclude` — if the LLM picked an excluded theme,
    // swap it out for the first engagement theme that is not in the exclusion
    // list. Deterministic, no LLM call.
    const exclude = (dueProbe.preferred_theme_exclude ?? []).map((s) => s.trim().toLowerCase());
    if (exclude.length > 0 && exclude.includes(briefing.disguise_theme.trim().toLowerCase())) {
      const engagementThemes = input.learnerModel.engagement_profile?.themes_that_land ?? [];
      const replacement = engagementThemes.find(
        (t) => !exclude.includes(t.trim().toLowerCase()),
      );
      if (replacement) briefing.disguise_theme = replacement;
    }
  }

  // Non-blocking telemetry.
  try {
    await recordMasterUsage({
      role: 'prescribe',
      model: resolved.model,
      latencyMs,
      tokensIn: estimateTokens(systemPrompt + userMessage),
      tokensOut: estimateTokens(raw),
    });
  } catch (err) {
    console.warn('[Master.prescribe] telemetry failed (swallowed):', err);
  }

  briefingCache.set(key, { briefing, at: Date.now(), requestedExerciseType: input.requestedExerciseType });
  return briefing;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function coerceBriefing(raw: unknown): Briefing | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const modalityChoice = typeof r.modality_choice === 'string' ? r.modality_choice : '';
  if (!MODALITIES.includes(modalityChoice as Modality)) return null;

  const expectedDifficulty =
    typeof r.expected_difficulty === 'string' ? r.expected_difficulty : '';
  if (!['easy', 'slight_stretch', 'challenge'].includes(expectedDifficulty)) return null;

  const requiredElements = Array.isArray(r.required_elements)
    ? r.required_elements.filter((x): x is string => typeof x === 'string')
    : null;
  const forbiddenElements = Array.isArray(r.forbidden_elements)
    ? r.forbidden_elements.filter((x): x is string => typeof x === 'string')
    : null;
  if (!requiredElements || !forbiddenElements) return null;

  if (typeof r.target_skill !== 'string' || !r.target_skill) return null;
  if (typeof r.disguise_theme !== 'string') return null;
  if (typeof r.success_criteria !== 'string') return null;

  const sessionSize =
    typeof r.session_size === 'string' && (r.session_size === 'standard' || r.session_size === 'mini')
      ? (r.session_size as 'standard' | 'mini')
      : undefined;

  const briefing: Briefing = {
    target_skill: r.target_skill,
    secondary_skill: typeof r.secondary_skill === 'string' ? r.secondary_skill : undefined,
    modality_choice: modalityChoice as Modality,
    disguise_theme: r.disguise_theme,
    required_elements: requiredElements,
    forbidden_elements: forbiddenElements,
    success_criteria: r.success_criteria,
    expected_difficulty: expectedDifficulty as Briefing['expected_difficulty'],
    rationale: typeof r.rationale === 'string' ? r.rationale : undefined,
    ...(sessionSize ? { session_size: sessionSize } : {}),
    ...(typeof r.blend_rationale === 'string' ? { blend_rationale: r.blend_rationale } : {}),
  };
  return briefing;
}

function estimateTokens(text: string): number {
  // Rough 4-chars-per-token heuristic; exact counts come from the edge function.
  return Math.max(1, Math.round(text.length / 4));
}

/**
 * Phase 8 (F-P8-02) — enforce `SessionIntent` hard pins on the briefing
 * in a deterministic, LLM-independent pass. Soft preferences are left
 * to the LLM (the system prompt already biases toward them).
 *
 * Hard pins enforced here:
 *   - `requested_modality` → rewrites `modality_choice`.
 *   - `requested_vocabulary` → merged into `required_elements` as
 *     outcome-style constraints ("The generated content must exercise
 *     the word \"X\".").
 *   - `review_focus` (card ids) → merged as a required_elements entry
 *     so the surface can lift these cards to the top of the queue.
 *   - `requested_difficulty` → overrides `expected_difficulty`.
 *
 * The returned briefing carries an annotated `blend_rationale` when any
 * pin was touched, so telemetry can audit the blending.
 *
 * Pure function — exported for tests.
 */
export function applySessionIntentPins(
  briefing: Briefing,
  intent: SessionIntent,
): Briefing {
  const notes: string[] = [];
  const next: Briefing = {
    ...briefing,
    required_elements: [...briefing.required_elements],
    forbidden_elements: [...briefing.forbidden_elements],
  };

  if (intent.requested_modality && next.modality_choice !== intent.requested_modality) {
    notes.push(`pinned_modality=${intent.requested_modality}`);
    next.modality_choice = intent.requested_modality;
    if (intent.requested_modality === 'live' && !next.session_size) {
      next.session_size = 'mini';
    }
  }

  const vocab = (intent.requested_vocabulary ?? []).filter((w) => !!w && w.trim().length > 0);
  if (vocab.length > 0) {
    notes.push(`pinned_vocab=${vocab.length}`);
    const quoted = vocab.map((w) => `"${w.trim()}"`).join(', ');
    next.required_elements.push(
      `Exercise the student-pinned vocabulary (${quoted}) naturally in the content.`,
    );
  }

  const reviewFocus = (intent.review_focus ?? []).filter((c) => !!c && c.trim().length > 0);
  if (reviewFocus.length > 0) {
    notes.push(`review_focus=${reviewFocus.length}`);
    next.required_elements.push(
      `Surface the pinned card id(s) first: [${reviewFocus.map((c) => c.trim()).join(', ')}].`,
    );
  }

  if (intent.requested_difficulty) {
    const mapped: Briefing['expected_difficulty'] =
      intent.requested_difficulty === 'easier'
        ? 'easy'
        : intent.requested_difficulty === 'harder'
          ? 'challenge'
          : 'slight_stretch';
    if (next.expected_difficulty !== mapped) {
      notes.push(`pinned_difficulty=${intent.requested_difficulty}`);
      next.expected_difficulty = mapped;
    }
  }

  if (notes.length > 0) {
    const prefix = next.blend_rationale ? next.blend_rationale + ' ' : '';
    next.blend_rationale = `${prefix}[session_intent] ${notes.join(', ')}.`;
  }

  return next;
}

/**
 * Phase 2 (F-P2-06) — Pick a disguise theme that is NOT dominant in the
 * recent Live window. Returns `null` when no rewrite is warranted.
 *
 * "Dominant" means:
 *   - The picked theme accounts for ≥ 40% of all themes seen in the window,
 *   - OR the window has ≥ 3 sessions AND the picked theme appears in the
 *     distinct set — i.e. consecutive Live sessions keep circling the same
 *     topic.
 *
 * When a rewrite is needed, we prefer a theme from
 * `engagement_profile.themes_that_land` that is not already in
 * `themes_in_window`. As a last resort we fall back to a small, curated
 * pool of neutral themes so the student never sees the same context back
 * to back. Purely deterministic; no LLM call.
 */
function pickDiverseTheme(currentTheme: string, learnerModel: LearnerModel): string | null {
  const profile = learnerModel.live_fluency_profile;
  if (!profile) return null;

  const windowThemes = profile.themes_in_window ?? [];
  if (windowThemes.length === 0) return null;

  const currentLower = currentTheme.trim().toLowerCase();
  if (!currentLower) return null;

  const themeCounts = new Map<string, number>();
  for (const t of windowThemes) {
    const key = t.trim().toLowerCase();
    if (!key) continue;
    themeCounts.set(key, (themeCounts.get(key) ?? 0) + 1);
  }

  const total = Array.from(themeCounts.values()).reduce((acc, n) => acc + n, 0);
  const currentShare = total > 0 ? (themeCounts.get(currentLower) ?? 0) / total : 0;

  const sessionsCount = profile.sessions_considered.length;
  const appearsInAllRecent =
    sessionsCount >= 3 && themeCounts.get(currentLower) === sessionsCount;

  const isDominant = currentShare >= 0.4 || appearsInAllRecent;
  if (!isDominant) return null;

  // Candidates: engagement themes first, then a neutral fallback pool.
  const engagementThemes = learnerModel.engagement_profile?.themes_that_land ?? [];
  const fallbackPool = [
    'weekend plans',
    'commuting',
    'cooking',
    'pets',
    'sports',
    'music',
    'travel',
    'work break',
    'family',
    'shopping',
  ];

  const seen = new Set(themeCounts.keys());
  seen.add(currentLower);

  const pick = (pool: string[]): string | null => {
    for (const candidate of pool) {
      const key = candidate.trim().toLowerCase();
      if (!key) continue;
      if (!seen.has(key)) return candidate.trim();
    }
    return null;
  };

  return pick(engagementThemes) ?? pick(fallbackPool);
}

// ---------------------------------------------------------------------------
// Phase 7 (F-P7-03) — scheduled re-exposure queue helpers
// ---------------------------------------------------------------------------

/**
 * Map a `ReExposureQueueEntry.preferred_modality` (which intentionally
 * includes the meta-modality `'review'`) to a concrete briefing
 * `Modality`. Returns `null` when no clean mapping exists — callers
 * should then keep the LLM's original modality choice.
 */
function toBriefingModality(
  pref: ReExposureQueueEntry['preferred_modality'],
): Modality | null {
  if (!pref) return null;
  if (pref === 'review') return null;
  return pref;
}

/**
 * Pick the earliest due entry from the learner's re-exposure queue.
 * Returns `null` when the queue is empty or nothing is due yet.
 *
 * Pure function — exported for tests.
 */
export function pickDueReExposure(
  learnerModel: LearnerModel,
): ReExposureQueueEntry | null {
  const queue = learnerModel.next_step_plan.re_exposure_queue ?? [];
  if (queue.length === 0) return null;
  const nowMs = Date.now();
  const due = queue
    .filter((e) => {
      const t = Date.parse(e.scheduled_for);
      return Number.isFinite(t) && t <= nowMs;
    })
    .sort((a, b) => Date.parse(a.scheduled_for) - Date.parse(b.scheduled_for));
  return due[0] ?? null;
}

/**
 * Build a new `ReExposureQueueEntry` relative to `now`, biasing toward
 * the Live modality (F-P7-03 specifies Live-biased re-exposure). The
 * spacing policy doubles on each successive probe: 24h → 48h → 96h,
 * capped at 7 days. When `priorProbes` is empty we start at 24h.
 *
 * Pure function — exported for tests.
 */
export function buildReExposureEntry(options: {
  patternId: string;
  themesToExclude?: string[];
  modality?: ReExposureQueueEntry['preferred_modality'];
  priorProbes?: number;
  now?: Date;
  reason?: string;
}): ReExposureQueueEntry {
  const base = options.now ?? new Date();
  const prior = Math.max(0, Math.floor(options.priorProbes ?? 0));
  const hours = Math.min(7 * 24, 24 * Math.pow(2, prior));
  const scheduledFor = new Date(base.getTime() + hours * 60 * 60 * 1000).toISOString();
  return {
    pattern_id: options.patternId,
    scheduled_for: scheduledFor,
    preferred_modality: options.modality ?? 'live',
    preferred_theme_exclude: options.themesToExclude?.filter((t) => !!t && t.trim().length > 0),
    reason: options.reason,
  };
}

