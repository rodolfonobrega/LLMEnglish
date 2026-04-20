import type { EvaluationResult } from '../../types/card';
import type { MetaAssessment } from '../../services/master/evaluate';

export type ExerciseStatus =
  | 'idle'
  | 'generating'
  | 'awaiting-user'
  | 'evaluating'
  | 'done';

export type SetupStep = 'theme' | 'generate';

export interface ExerciseState {
  status: ExerciseStatus;
  setupStep: SetupStep;
  prompt: string;
  evaluation: EvaluationResult | null;
  metaAssessment: MetaAssessment | null;
  userAudioBase64: string | null;
  error: string | null;
  saved: boolean;
}

export const initialExerciseState: ExerciseState = {
  status: 'idle',
  setupStep: 'theme',
  prompt: '',
  evaluation: null,
  metaAssessment: null,
  userAudioBase64: null,
  error: null,
  saved: false,
};

export type ExerciseAction =
  | { type: 'SETUP_STEP'; step: SetupStep }
  | { type: 'GENERATION_START' }
  | { type: 'GENERATION_SUCCESS'; prompt: string }
  | { type: 'GENERATION_ERROR'; message: string }
  | { type: 'EVALUATION_START'; audioBase64: string }
  | { type: 'EVALUATION_SUCCESS'; result: EvaluationResult }
  | { type: 'META_ASSESSMENT_SUCCESS'; meta: MetaAssessment }
  | { type: 'EVALUATION_ERROR'; message: string }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_ERROR'; message: string }
  | { type: 'RESET' }
  | { type: 'RETRY_SAME' }
  | { type: 'DISMISS_ERROR' };

export function exerciseReducer(
  state: ExerciseState,
  action: ExerciseAction,
): ExerciseState {
  switch (action.type) {
    case 'SETUP_STEP':
      return { ...state, setupStep: action.step };

    case 'GENERATION_START':
      return {
        ...state,
        status: 'generating',
        error: null,
        evaluation: null,
        metaAssessment: null,
        saved: false,
        userAudioBase64: null,
        prompt: '',
      };

    case 'GENERATION_SUCCESS':
      return {
        ...state,
        status: 'awaiting-user',
        prompt: action.prompt,
      };

    case 'GENERATION_ERROR':
      return {
        ...state,
        status: 'idle',
        error: action.message,
      };

    case 'EVALUATION_START':
      return {
        ...state,
        status: 'evaluating',
        error: null,
        userAudioBase64: action.audioBase64,
      };

    case 'EVALUATION_SUCCESS':
      return {
        ...state,
        status: 'done',
        evaluation: action.result,
        metaAssessment: null,
      };

    case 'META_ASSESSMENT_SUCCESS':
      return {
        ...state,
        metaAssessment: action.meta,
      };

    case 'EVALUATION_ERROR':
      return {
        ...state,
        status: 'awaiting-user',
        error: action.message,
      };

    case 'SAVE_SUCCESS':
      return { ...state, saved: true };

    case 'SAVE_ERROR':
      return { ...state, error: action.message };

    case 'RESET':
      return { ...initialExerciseState };

    case 'RETRY_SAME':
      return {
        ...state,
        status: 'awaiting-user',
        evaluation: null,
        metaAssessment: null,
        error: null,
        saved: false,
        userAudioBase64: null,
      };

    case 'DISMISS_ERROR':
      return { ...state, error: null };
  }
}
