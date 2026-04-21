/**
 * liveFluencyAggregator — Phase 2 (F-P2-04).
 *
 * Deterministic, LLM-free aggregator for `LiveFluencyProfile` — the "mother
 * metric" of the app (see `docs/master-integration-plan.md` §5.5 and §11.1).
 *
 * Everything here is a pure function of the raw `turns[]` + scenario theme.
 * No Master calls, no Supabase calls, no randomness. The post-conversation
 * pipeline feeds the output of `computeLiveSessionPoint` into
 * `mergeIntoProfile`, which returns the next profile snapshot; the caller
 * emits a single `live_fluency.update` patch with it.
 *
 * Why aggregator-in-code instead of in the LLM:
 *   - These numbers must not drift session-to-session.
 *   - They're the ground truth Phase 7 reads to decide "improving / stable /
 *     regressing / noisy", and the bias input Phase 2.6 reads to decide
 *     which theme to prescribe next.
 *   - LLMs are terrible at counting tokens, measuring latency, and
 *     computing averages. We don't ask them to.
 */

import type { ConversationTurn } from '../../types/scenario';
import type {
  LiveFluencyProfile,
  LiveSessionPoint,
  TrajectoryState,
} from '../../types/learnerModel';

/** Default rolling-window size. See §5.5 "last-N-sessions, N=10". */
export const DEFAULT_WINDOW_SIZE = 10;

/** Empty profile used when no Live sessions have been logged yet. */
export function emptyProfile(): LiveFluencyProfile {
  return {
    sessions_considered: [],
    avg_turn_length_words: null,
    median_turn_length_words: null,
    longest_turn_words: null,
    avg_response_latency_ms: null,
    abandoned_turn_rate: null,
    lexical_diversity_estimate: null,
    distinct_themes_in_window: 0,
    themes_in_window: [],
    trajectory: 'noisy',
    session_points: [],
  };
}

interface ComputePointInput {
  sessionId: string;
  /** Turns as captured by `ConversationAnalysis` (user + ai interleaved). */
  turns: ConversationTurn[];
  /** Scenario theme — will be lowercased for stable grouping. */
  theme: string;
  /** Whether this was a mini-live; stamped onto the point for Phase 7. */
  size?: 'standard' | 'mini';
  /** ISO timestamp the session ended at. Defaults to `now`. */
  endedAt?: string;
}

/**
 * Build one `LiveSessionPoint` from the raw conversation turns. This is the
 * unit that feeds `mergeIntoProfile`.
 *
 * Definitions (kept simple — we want these numbers to be intuitive):
 *
 *   - `turns_count`: number of **user** turns (not AI) so it matches "how
 *     much the student spoke".
 *   - `avg_turn_length_words`: mean whitespace-separated word count across
 *     user turns (ignores empty / transcription-failed turns).
 *   - `avg_response_latency_ms`: mean of `userTurn.timestamp -
 *     previousAiTurn.timestamp` across consecutive (ai → user) pairs. Only
 *     counted for user turns that directly follow an AI turn; if the first
 *     turn is user or two user turns stack, we skip. 0 or negative deltas
 *     are clamped to 0.
 *   - `abandoned_turn_count`: user turns considered "abandoned" — defined
 *     as text with fewer than 2 words AND no clear terminator (`?`, `.`,
 *     `!`). Empty transcripts count.
 */
export function computeLiveSessionPoint(input: ComputePointInput): LiveSessionPoint {
  const { sessionId, turns, theme } = input;
  const endedAt = input.endedAt ?? new Date().toISOString();
  const size = input.size ?? 'standard';

  const userTurns = turns.filter((t) => t.role === 'user');

  const wordCounts: number[] = userTurns.map((t) => countWords(t.text));
  const nonEmptyWordCounts = wordCounts.filter((n) => n > 0);

  const avgTurnLengthWords =
    nonEmptyWordCounts.length > 0
      ? nonEmptyWordCounts.reduce((a, b) => a + b, 0) / nonEmptyWordCounts.length
      : 0;

  let latencySum = 0;
  let latencyCount = 0;
  for (let i = 0; i < turns.length; i++) {
    const current = turns[i];
    if (current.role !== 'user') continue;
    const previous = turns[i - 1];
    if (!previous || previous.role !== 'ai') continue;
    const delta = current.timestamp - previous.timestamp;
    if (!Number.isFinite(delta)) continue;
    latencySum += Math.max(0, delta);
    latencyCount += 1;
  }
  const avgResponseLatencyMs = latencyCount > 0 ? latencySum / latencyCount : 0;

  const abandonedTurnCount = userTurns.reduce((acc, t) => {
    const text = (t.text ?? '').trim();
    if (text.length === 0) return acc + 1;
    const words = countWords(text);
    const hasTerminator = /[.!?]$/.test(text);
    if (words < 2 && !hasTerminator) return acc + 1;
    return acc;
  }, 0);

  return {
    session_id: sessionId,
    at: endedAt,
    theme: normalizeTheme(theme),
    size,
    turns_count: userTurns.length,
    avg_turn_length_words: round1(avgTurnLengthWords),
    avg_response_latency_ms: Math.round(avgResponseLatencyMs),
    abandoned_turn_count: abandonedTurnCount,
  };
}

/**
 * Insert a new session point into a profile and recompute aggregates.
 * Newest-last ordering; window bounded by `windowSize`.
 */
export function mergeIntoProfile(
  profile: LiveFluencyProfile | undefined,
  point: LiveSessionPoint,
  windowSize: number = DEFAULT_WINDOW_SIZE,
): LiveFluencyProfile {
  const base = profile ?? emptyProfile();

  const nextPoints = dedupeBySession([...base.session_points, point]).slice(-windowSize);

  const sessionsConsidered = nextPoints.map((p) => p.session_id);
  const themes = nextPoints.map((p) => p.theme);
  const distinctThemes = Array.from(new Set(themes));

  const turnWordCountsAll = collectTurnLengths(nextPoints);
  const avgTurn = mean(turnWordCountsAll);
  const medianTurn = median(turnWordCountsAll);
  const longestTurn = turnWordCountsAll.length > 0 ? Math.max(...turnWordCountsAll) : null;

  const latencies = nextPoints.map((p) => p.avg_response_latency_ms).filter((n) => n > 0);
  const avgLatency = mean(latencies);

  const totalTurns = nextPoints.reduce((a, p) => a + p.turns_count, 0);
  const totalAbandoned = nextPoints.reduce((a, p) => a + p.abandoned_turn_count, 0);
  const abandonedRate = totalTurns > 0 ? clamp01(totalAbandoned / totalTurns) : null;

  const lexicalDiversity = estimateLexicalDiversity(nextPoints);

  const trajectory = computeTrajectory(nextPoints);

  return {
    sessions_considered: sessionsConsidered,
    avg_turn_length_words: avgTurn,
    median_turn_length_words: medianTurn,
    longest_turn_words: longestTurn,
    avg_response_latency_ms: avgLatency !== null ? Math.round(avgLatency) : null,
    abandoned_turn_rate: abandonedRate,
    lexical_diversity_estimate: lexicalDiversity,
    distinct_themes_in_window: distinctThemes.length,
    themes_in_window: themes,
    trajectory,
    session_points: nextPoints,
  };
}

// ---------------------------------------------------------------------------
// Helpers — all pure, all exported for tests.
// ---------------------------------------------------------------------------

export function computeTrajectory(points: LiveSessionPoint[]): TrajectoryState {
  if (points.length < 3) return 'noisy';

  const perSessionScore = points.map((p) => {
    const abandonRate = p.turns_count > 0 ? p.abandoned_turn_count / p.turns_count : 0;
    return Math.max(0, p.avg_turn_length_words * (1 - abandonRate));
  });

  // Classify as noisy when the signal is dominated by alternation rather
  // than trend. We compare the lagged-difference magnitudes (session-to-
  // session jitter) against the aggregate drift (older-half mean vs newer-
  // half mean). If jitter dwarfs drift we refuse to call a trend.
  const half = Math.floor(perSessionScore.length / 2);
  const earlier = perSessionScore.slice(0, perSessionScore.length - half);
  const later = perSessionScore.slice(perSessionScore.length - half);

  const earlierMean = mean(earlier) ?? 0;
  const laterMean = mean(later) ?? 0;
  const delta = laterMean - earlierMean;

  const jitterValues: number[] = [];
  for (let i = 1; i < perSessionScore.length; i++) {
    jitterValues.push(Math.abs(perSessionScore[i] - perSessionScore[i - 1]));
  }
  const jitter = mean(jitterValues) ?? 0;

  const scoreMean = mean(perSessionScore) ?? 0;
  const jitterRatio = scoreMean > 0 ? jitter / scoreMean : 0;

  if (jitterRatio > 0.5 && jitter > Math.abs(delta)) return 'noisy';
  if (delta > 0.75) return 'improving';
  if (delta < -0.75) return 'regressing';
  return 'stable';
}

function estimateLexicalDiversity(points: LiveSessionPoint[]): number | null {
  if (points.length === 0) return null;
  const lengths = points.map((p) => p.avg_turn_length_words);
  const meanLen = mean(lengths);
  if (meanLen === null || meanLen === 0) return 0;
  const normalised = Math.min(1, meanLen / 15);
  return round2(normalised);
}

function collectTurnLengths(points: LiveSessionPoint[]): number[] {
  return points.map((p) => p.avg_turn_length_words).filter((n) => n > 0);
}

function dedupeBySession(points: LiveSessionPoint[]): LiveSessionPoint[] {
  const seen = new Map<string, LiveSessionPoint>();
  for (const p of points) seen.set(p.session_id, p);
  return Array.from(seen.values()).sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

function normalizeTheme(theme: string): string {
  return theme.trim().toLowerCase();
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = values.reduce((a, b) => a + b, 0);
  return round1(s / values.length);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const raw =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return round1(raw);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
