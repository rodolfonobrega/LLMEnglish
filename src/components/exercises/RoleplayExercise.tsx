import { Theater } from 'lucide-react';
import { ExerciseShell, type ExerciseShellConfig } from './ExerciseShell';
import { getRoleplayGenerationPrompt } from '../../utils/prompts';

const config: ExerciseShellConfig = {
  type: 'roleplay',
  label: 'Situação',
  icon: Theater,
  promptLabel: 'Situação (fale em inglês como lidaria com isso)',
  evalType: 'role-play situation',
  skeletonLines: 3,
  hasVocab: true,
  contextPlaceholder: 'ex: devolver um produto, consulta médica',
  userMessage: 'Generate a role-play situation.',
  buildSystemPrompt: ({ vocabArr, context, theme, tone }) =>
    getRoleplayGenerationPrompt(context, theme || undefined, vocabArr, tone),
};

export function RoleplayExercise() {
  return <ExerciseShell config={config} />;
}
