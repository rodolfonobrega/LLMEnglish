import { useSearchParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ExerciseMode } from '../discovery/ExerciseMode';
import { ImageMode } from '../discovery/ImageMode';
import { Button } from '../ui/Button';
import type { ExerciseType } from '../discovery/ExerciseMode';

const MODE_MAP: Record<string, ExerciseType> = {
  phrases: 'phrase',
  texts: 'text',
  situations: 'roleplay',
};

const TITLE_MAP: Record<ExerciseType, string> = {
  phrase: 'Frases',
  text: 'Textos',
  roleplay: 'Situações',
};

const SUBTITLE_MAP: Record<ExerciseType, string> = {
  phrase: 'Receba uma situação e fale a frase em inglês',
  text: 'Receba um texto em português e fale em inglês com naturalidade',
  roleplay: 'Responda a um cenário real em inglês',
};

export function ExercisesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = searchParams.get('mode');

  if (mode === 'visual') {
    return (
      <div className="space-y-6 pb-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/practice')}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ChevronLeft size={18} />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Desafio Visual</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Veja uma imagem e descreva o que acontece em inglês.
          </p>
        </div>
        <ImageMode />
      </div>
    );
  }

  const exerciseType: ExerciseType = MODE_MAP[mode ?? ''] ?? 'phrase';
  const title = TITLE_MAP[exerciseType];
  const subtitle = SUBTITLE_MAP[exerciseType];

  return (
    <div className="space-y-6 pb-20">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/practice')}
        className="text-muted-foreground hover:text-foreground -ml-2"
      >
        <ChevronLeft size={18} />
        Voltar
      </Button>
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">{title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
      </div>
      <ExerciseMode initialType={exerciseType} />
    </div>
  );
}
