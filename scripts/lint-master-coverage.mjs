/**
 * Master coverage linter — Phase 1 (F-P1-05).
 *
 * Walks the user-facing surfaces that issue production `chatCompletion`
 * calls to the LLM and enforces that every one of them either:
 *
 *   (a) touches the Master pipeline (`runMasterPipeline`,
 *       `recordDrillOutcome`, or `recordEngagement`), OR
 *   (b) has a `// MASTER-EXEMPT: <reason>` marker somewhere in the file.
 *
 * This guards against regressions where a new drill/surface silently
 * stops feeding the Master. Run with:
 *
 *   npm run lint:master
 *
 * Exits non-zero with a human-readable report when any surface is
 * uncovered.
 *
 * Kept as a Node .mjs script on purpose — it needs multi-file reasoning
 * that ESLint rules can't easily express and must run without any
 * extra TS runner installed.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const SURFACE_DIRS = [
  'src/components/exercises',
  'src/components/review',
  'src/components/live-roleplay',
  'src/components/paths',
  'src/components/discovery',
  'src/components/lesson',
];
const SINGLE_FILES = ['src/components/practice/PracticePage.tsx'];

const CALL_PATTERN = /\bchatCompletion(?:WithImage)?\s*\(/;
const EVALUATION_SIGNAL = /\brunMasterPipeline\s*\(/;
const DRILL_SIGNAL = /\brecordDrillOutcome\s*\(/;
const ENGAGEMENT_SIGNAL = /\brecordEngagement\s*\(/;
const LIVE_SIGNAL = /\brunLivePipeline\s*\(/;
// Scenario generators consume Master guidance via `MasterScenarioHints`
// (Phase 2 F-P2-02); the corresponding post-session evaluator is
// `runLivePipeline` on ConversationAnalysis. Treat passing masterHints
// into the prompt builder as sufficient coverage for these surfaces.
const SCENARIO_HINTS_SIGNAL = /\bMasterScenarioHints\b/;
const USE_EXERCISE_EVAL = /\buseExerciseEvaluation\b/;
const LESSON_UPDATE = /\bupdateLearnerModel\s*\(/;
const EXEMPT_MARKER = /\/\/\s*MASTER-EXEMPT:/i;
const IGNORED_FILENAMES = /\.(test|spec)\.tsx?$/;

function listTsxFiles(dir) {
  const abs = join(ROOT, dir);
  let entries;
  try {
    entries = readdirSync(abs);
  } catch {
    return [];
  }

  const out = [];
  for (const entry of entries) {
    const full = join(abs, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listTsxFiles(join(dir, entry)));
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (IGNORED_FILENAMES.test(entry)) continue;
    out.push(join(dir, entry));
  }
  return out;
}

function collectFiles() {
  const out = new Set();
  for (const d of SURFACE_DIRS) {
    for (const f of listTsxFiles(d)) out.add(f);
  }
  for (const f of SINGLE_FILES) out.add(f);
  return [...out].sort();
}

function analyseFile(relPath) {
  const contents = readFileSync(join(ROOT, relPath), 'utf8');
  if (!CALL_PATTERN.test(contents)) return null;

  if (EXEMPT_MARKER.test(contents)) return null;
  if (EVALUATION_SIGNAL.test(contents)) return null;
  if (DRILL_SIGNAL.test(contents)) return null;
  if (ENGAGEMENT_SIGNAL.test(contents)) return null;
  if (LIVE_SIGNAL.test(contents)) return null;
  if (SCENARIO_HINTS_SIGNAL.test(contents)) return null;
  if (USE_EXERCISE_EVAL.test(contents)) return null;
  if (LESSON_UPDATE.test(contents)) return null;

  return {
    file: relPath,
    reason:
      'Production chatCompletion call detected but no Master pipeline touch ' +
      '(runMasterPipeline / recordDrillOutcome / recordEngagement / ' +
      'runLivePipeline / MasterScenarioHints / useExerciseEvaluation / ' +
      'updateLearnerModel) and no MASTER-EXEMPT marker.',
  };
}

function main() {
  const files = collectFiles();
  const findings = [];

  for (const f of files) {
    const finding = analyseFile(f);
    if (finding) findings.push(finding);
  }

  if (findings.length === 0) {
    console.log(
      `[master-coverage] ok — ${files.length} surfaces scanned, all covered.`,
    );
    return;
  }

  console.error(
    `[master-coverage] FAIL — ${findings.length} uncovered surface(s) out of ${files.length}:`,
  );
  for (const f of findings) {
    console.error(`  • ${relative(ROOT, join(ROOT, f.file))}\n    ${f.reason}`);
  }
  console.error(
    '\nAdd one of runMasterPipeline / recordDrillOutcome / recordEngagement, ' +
      'or annotate the file with `// MASTER-EXEMPT: <reason>`.',
  );
  process.exit(1);
}

main();
