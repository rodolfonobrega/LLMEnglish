/**
 * Tutor explanation service.
 *
 * Formerly inlined in `ReviewPage.tsx` — extracted here so that the Master
 * agent (Wave 5) can depend on a single source of truth for "Why is this
 * wrong?" narration and keep the UI layer thin.
 *
 * The service is intentionally LLM-source-agnostic: it composes the prompt
 * and routes through the shared `chatCompletion` transport.
 */

import { chatCompletion } from './openai';
import { getTutorExplanationPrompt } from '../utils/prompts';
import type { CorrectionItem } from '../types/card';
import type { ConversationTone } from '../types/settings';

const TUTOR_SYSTEM_PROMPT =
  'You are a patient, encouraging English tutor. Explain mistakes clearly and provide helpful examples.';

export interface TutorExplainInput {
  prompt: string;
  userTranscription: string;
  correctedVersion: string;
  corrections: (CorrectionItem | string)[];
  tone?: ConversationTone;
}

/**
 * Ask the model for a short tutor-style explanation of a correction.
 * Returns the raw text (Portuguese narration with English examples).
 */
export async function explainCorrection(input: TutorExplainInput): Promise<string> {
  const userPrompt = getTutorExplanationPrompt(
    input.prompt,
    input.userTranscription,
    input.correctedVersion,
    input.corrections,
    input.tone,
  );
  return chatCompletion(TUTOR_SYSTEM_PROMPT, userPrompt);
}
