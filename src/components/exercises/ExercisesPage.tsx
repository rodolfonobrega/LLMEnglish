import { Sparkles } from 'lucide-react';
import { ExerciseMode } from '../discovery/ExerciseMode';

export function ExercisesPage() {
  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[var(--amber-soft)] rounded-2xl">
          <Sparkles size={24} className="text-[var(--amber)]" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Exercícios de Fala</h1>
          <p className="text-muted-foreground text-sm">Pratique frases, textos e situações em inglês.</p>
        </div>
      </div>

      <ExerciseMode />
    </div>
  );
}
