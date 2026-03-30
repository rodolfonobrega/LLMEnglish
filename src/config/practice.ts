export const practicePrimaryModes = [
  { id: 'exercises', to: '/exercises', title: 'Exercicios' },
  { id: 'live', to: '/live', title: 'Simulacao ao vivo' },
] as const;

export const practiceSecondaryTools = [
  { id: 'paths', to: '/paths', title: 'Trilhas' },
  { id: 'scripts', to: '/scripts', title: 'Scripts' },
  { id: 'history', to: '/history', title: 'Historico' },
  { id: 'errors', to: '/errors', title: 'Erros' },
] as const;

export const exerciseSetupSteps = ['format', 'type', 'theme', 'generate'] as const;
