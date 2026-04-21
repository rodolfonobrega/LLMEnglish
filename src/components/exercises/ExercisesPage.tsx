import { useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ExerciseMode } from '../discovery/ExerciseMode';
import { ImageMode } from '../discovery/ImageMode';
import { Button } from '../ui/Button';
import type { ExerciseType } from '../discovery/ExerciseMode';
import { OralCloze } from './OralCloze';
import { ErrorSpotting } from './ErrorSpotting';
import { ReactionDrill } from './ReactionDrill';
import { ActiveShadowing } from './ActiveShadowing';
import { Reformulation } from './Reformulation';
import { NarrativeContinuation } from './NarrativeContinuation';
import { DirectedListening } from './DirectedListening';
import type { Briefing } from '../../types/master';

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

interface FocusedDrillMeta {
  title: string;
  subtitle: string;
  Component: React.ComponentType<{ briefing?: Briefing }>;
}

const FOCUSED_DRILL_MAP: Record<string, FocusedDrillMeta> = {
  cloze: {
    title: 'Complete a Frase',
    subtitle: 'Ouça uma frase com uma palavra faltando e diga a palavra em voz alta',
    Component: OralCloze,
  },
  spotting: {
    title: 'Ache o Erro',
    subtitle: 'Ouça uma frase com um erro plantado e diga a versão correta',
    Component: ErrorSpotting,
  },
  reaction: {
    title: 'Reação Rápida',
    subtitle: 'Responda a provocações curtas com velocidade — drill de automatismo',
    Component: ReactionDrill,
  },
  shadowing: {
    title: 'Sombra Ativa',
    subtitle: 'Ouça uma frase e repita imitando ritmo, pausas e contrações',
    Component: ActiveShadowing,
  },
  reformulation: {
    title: 'Reformulação',
    subtitle: 'Reformule uma frase rígida em inglês mais casual, curto ou natural',
    Component: Reformulation,
  },
  narrative: {
    title: 'Continue a História',
    subtitle: 'Ouça um começo de história e continue em inglês por até 60 segundos',
    Component: NarrativeContinuation,
  },
  listening: {
    title: 'Escuta Direcionada',
    subtitle: 'Ouça um trecho falado e responda perguntas sobre o que entendeu',
    Component: DirectedListening,
  },
};

export function ExercisesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const mode = searchParams.get('mode');
  const briefing = useMemo<Briefing | undefined>(() => {
    const raw = (location.state as { briefing?: Briefing } | null)?.briefing;
    return raw ?? undefined;
  }, [location.state]);

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
        <ImageMode briefing={briefing} />
      </div>
    );
  }

  if (mode && FOCUSED_DRILL_MAP[mode]) {
    const drill = FOCUSED_DRILL_MAP[mode];
    const Component = drill.Component;
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
          <h1 className="text-2xl font-extrabold text-foreground">{drill.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{drill.subtitle}</p>
        </div>
        <Component briefing={briefing} />
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
