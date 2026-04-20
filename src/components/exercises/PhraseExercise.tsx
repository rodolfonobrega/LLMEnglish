import { MessageCircle } from 'lucide-react';
import { ExerciseShell, type ExerciseShellConfig } from './ExerciseShell';
import { getPhraseGenerationPrompt } from '../../utils/prompts';

const config: ExerciseShellConfig = {
  type: 'phrase',
  label: 'Frase',
  icon: MessageCircle,
  promptLabel: 'Fale isso em inglês',
  evalType: 'phrase translation',
  skeletonLines: 2,
  hasVocab: true,
  contextPlaceholder: 'ex: pedir um café, entrevista de emprego',
  userMessage: 'Generate a phrase.',
  buildSystemPrompt: ({ vocabArr, context, theme, tone }) =>
    getPhraseGenerationPrompt(vocabArr, context, theme || undefined, tone),
};

export function PhraseExercise() {
  return <ExerciseShell config={config} />;
}
