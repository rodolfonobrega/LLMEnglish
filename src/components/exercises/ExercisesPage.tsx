import { useSearchParams } from 'react-router-dom';
import { ExerciseMode } from '../discovery/ExerciseMode';
import { ImageMode } from '../discovery/ImageMode';

export function ExercisesPage() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');

  if (mode === 'visual') {
    return (
      <div className="space-y-6 pb-20">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Desafio Visual</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Veja uma imagem e descreva o que acontece em ingles.
          </p>
        </div>

        <ImageMode />
      </div>
    );
  }

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
