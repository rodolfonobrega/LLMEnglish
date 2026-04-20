import { FileText } from 'lucide-react';
import { ExerciseShell, type ExerciseShellConfig } from './ExerciseShell';
import { getTextGenerationPrompt } from '../../utils/prompts';

const config: ExerciseShellConfig = {
  type: 'text',
  label: 'Texto',
  icon: FileText,
  promptLabel: 'Fale isso em inglês (naturalmente)',
  evalType: 'text translation',
  skeletonLines: 4,
  hasVocab: true,
  contextPlaceholder: 'ex: pedir um café, entrevista de emprego',
  userMessage: 'Generate a text passage.',
  buildSystemPrompt: ({ vocabArr, context, theme, tone }) =>
    getTextGenerationPrompt(vocabArr, context, theme || undefined, tone),
};

export function TextExercise() {
  return <ExerciseShell config={config} />;
}
