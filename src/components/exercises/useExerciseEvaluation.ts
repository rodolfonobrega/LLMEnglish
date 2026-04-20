import { useReducer, useCallback } from 'react';
import {
  exerciseReducer,
  initialExerciseState,
  type ExerciseState,
  type ExerciseAction,
} from './exerciseReducer';
import type { ExerciseType } from '../discovery/ExerciseMode';
import { chatCompletion, speechToText } from '../../services/openai';
import {
  getEvaluationPrompt,
  evaluationResponseSchema,
} from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import { createDefaultCard } from '../../services/spacedRepetition';
import { addCard } from '../../services/storage';
import { extractErrorPatterns, recordErrorPatterns } from '../../services/errorAnalysis';
import { addXP, syncGamificationState } from '../../services/gamification';
import { XP_PER_EXERCISE, XP_PER_PERFECT_SCORE } from '../../types/gamification';
import type { EvaluationResult } from '../../types/card';
import { normalizeEvaluationResult } from '../../types/card';
import type { ConversationTone } from '../../types/settings';
import { masterEnabled } from '../../services/runtimeConfigSnapshot';
import { getCurrentUser } from '../../services/supabase/auth';
import { loadLearnerModel } from '../../services/learnerModel';
import { masterEvaluate } from '../../services/master/evaluate';
import { updateLearnerModel } from '../../services/master/updateModel';
import type { Briefing } from '../../types/master';

interface SaveCardContext {
  type: ExerciseType;
  targetVocab?: string;
  hasVocab: boolean;
  context?: string;
  theme?: string | null;
}

interface UseExerciseEvaluationParams {
  evalType: string;
  tone: ConversationTone;
  buildSystemPrompt: () => string;
  userMessage: string;
  validateSetup: () => string | null;
  getSaveContext: () => SaveCardContext;
  /** Optional Master briefing passed via navigation state. */
  briefing?: Briefing | null;
}

export interface UseExerciseEvaluationReturn {
  state: ExerciseState;
  dispatch: React.Dispatch<ExerciseAction>;
  generate: () => Promise<void>;
  handleAudioReady: (blob: Blob, base64: string) => Promise<void>;
  handleSaveToLibrary: () => Promise<void>;
  reset: () => void;
  retrySame: () => void;
}

export function useExerciseEvaluation(
  params: UseExerciseEvaluationParams,
): UseExerciseEvaluationReturn {
  const [state, dispatch] = useReducer(exerciseReducer, initialExerciseState);

  const generate = useCallback(async () => {
    const validationError = params.validateSetup();
    if (validationError) {
      dispatch({ type: 'GENERATION_ERROR', message: validationError });
      return;
    }
    dispatch({ type: 'GENERATION_START' });
    try {
      const systemPrompt = params.buildSystemPrompt();
      const result = await chatCompletion(systemPrompt, params.userMessage);
      dispatch({ type: 'GENERATION_SUCCESS', prompt: result.trim() });
    } catch (err) {
      dispatch({
        type: 'GENERATION_ERROR',
        message: err instanceof Error ? err.message : 'Failed to generate',
      });
    }
  }, [params]);

  const handleAudioReady = useCallback(
    async (blob: Blob, base64: string) => {
      dispatch({ type: 'EVALUATION_START', audioBase64: base64 });
      try {
        const transcription = await speechToText(blob);
        const evalPrompt = getEvaluationPrompt(
          state.prompt,
          transcription,
          params.evalType,
          params.tone,
        );
        const evalResponse = await chatCompletion(
          'You are an expert English language evaluator. Respond only with valid JSON.',
          evalPrompt,
          undefined,
          evaluationResponseSchema,
        );
        const cleanResponse = cleanJson(evalResponse);
        const parsed: EvaluationResult = JSON.parse(cleanResponse);
        parsed.userTranscription = transcription;
        const evalResult = normalizeEvaluationResult(parsed);

        // Show evaluation immediately — user should always see their result
        dispatch({ type: 'EVALUATION_SUCCESS', result: evalResult });

        // Background persistence: do not block or replace the evaluation on failure
        try {
          const exerciseSessionId = `exercise_${Date.now()}`;
          const patterns = await extractErrorPatterns(
            evalResult,
            state.prompt,
            exerciseSessionId,
          );
          await recordErrorPatterns(patterns);
          let xp = XP_PER_EXERCISE;
          if (evalResult.score >= 9) xp += XP_PER_PERFECT_SCORE;
          await addXP(xp);
          await syncGamificationState();
        } catch (persistErr) {
          console.warn(
            'Background persistence failed (evaluation still shown):',
            persistErr,
          );
        }

        // Master (silent) — produce a MetaAssessment to rerank corrections, and
        // fire-and-forget update the LearnerModel. Never blocks the user.
        if (masterEnabled() && params.briefing) {
          void (async () => {
            try {
              const user = getCurrentUser();
              if (!user) return;
              const learnerModel = await loadLearnerModel(user.id);
              const meta = await masterEvaluate({
                briefing: params.briefing!,
                evaluationResult: evalResult,
                learnerModel,
              });
              if (meta) {
                dispatch({ type: 'META_ASSESSMENT_SUCCESS', meta });
              }
              void updateLearnerModel({
                learnerModel,
                evaluationResult: evalResult,
                metaAssessment: meta,
                sessionSummary: {
                  userId: user.id,
                  modality: params.briefing!.modality_choice,
                  disguiseTheme: params.briefing!.disguise_theme,
                  targetSkill: params.briefing!.target_skill,
                  endedAt: new Date().toISOString(),
                },
              });
            } catch (masterErr) {
              console.warn('[Master] post-evaluation pipeline failed (swallowed):', masterErr);
            }
          })();
        }
      } catch (err) {
        dispatch({
          type: 'EVALUATION_ERROR',
          message: err instanceof Error ? err.message : 'Evaluation failed',
        });
      }
    },
    [state.prompt, params.evalType, params.tone, params.briefing],
  );

  const handleSaveToLibrary = useCallback(async () => {
    if (!state.evaluation) return;
    const ctx = params.getSaveContext();

    const card = createDefaultCard({
      type: ctx.type,
      prompt: state.prompt,
      targetVocabulary:
        ctx.hasVocab && ctx.targetVocab
          ? ctx.targetVocab.split(',').map((v) => v.trim())
          : undefined,
      context: ctx.context || undefined,
      theme: ctx.theme || undefined,
      latestEvaluation: state.evaluation,
      userAudioBlob: state.userAudioBase64 || undefined,
    });

    try {
      await addCard(card);
      await syncGamificationState();
      dispatch({ type: 'SAVE_SUCCESS' });
    } catch (err) {
      dispatch({
        type: 'SAVE_ERROR',
        message: err instanceof Error ? err.message : 'Falha ao salvar na biblioteca',
      });
    }
  }, [state.evaluation, state.prompt, state.userAudioBase64, params]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const retrySame = useCallback(() => {
    dispatch({ type: 'RETRY_SAME' });
  }, []);

  return {
    state,
    dispatch,
    generate,
    handleAudioReady,
    handleSaveToLibrary,
    reset,
    retrySame,
  };
}
