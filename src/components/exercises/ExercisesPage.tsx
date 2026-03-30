import { ExerciseMode } from '../discovery/ExerciseMode';

export function ExercisesPage() {
  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Exercicios de Fala</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Escolha o formato, personalize o tema e pratique ingles no seu ritmo.
        </p>
      </div>

      <ExerciseMode />
    </div>
  );
}
