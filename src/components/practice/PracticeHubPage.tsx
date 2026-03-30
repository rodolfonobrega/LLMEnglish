import { useNavigate } from 'react-router-dom';
import { Mic, Video, Route, ScrollText, Clock, AlertTriangle } from 'lucide-react';
import { practicePrimaryModes, practiceSecondaryTools } from '../../config/practice';

const modeIcons: Record<string, React.ElementType> = {
  exercises: Mic,
  live: Video,
};

const modeDescriptions: Record<string, string> = {
  exercises: 'Exercicios de fala com avaliacao por IA',
  live: 'Converse em tempo real com cenarios interativos',
};

const toolIcons: Record<string, React.ElementType> = {
  paths: Route,
  scripts: ScrollText,
  history: Clock,
  errors: AlertTriangle,
};

export function PracticeHubPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Praticar</h1>
        <p className="text-muted-foreground mt-1">
          Escolha um modo de pratica ou acesse suas ferramentas.
        </p>
      </div>

      {/* Primary Modes */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Modos de pratica
        </h2>
        <div className="grid gap-4">
          {practicePrimaryModes.map((mode) => {
            const Icon = modeIcons[mode.id] ?? Mic;
            return (
              <button
                key={mode.id}
                onClick={() => navigate(mode.to)}
                className="w-full flex items-center gap-4 bg-card border border-border rounded-2xl p-5 text-left cursor-pointer card-hover hover:border-[hsl(var(--sky))] transition-colors duration-200"
              >
                <div className="w-12 h-12 bg-sky-soft rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-sky" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{mode.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {modeDescriptions[mode.id]}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Secondary Tools */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Ferramentas
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {practiceSecondaryTools.map((tool) => {
            const Icon = toolIcons[tool.id] ?? Route;
            return (
              <button
                key={tool.id}
                onClick={() => navigate(tool.to)}
                className="flex flex-col items-center gap-2 bg-card border border-border rounded-xl p-4 text-center cursor-pointer card-hover hover:border-[hsl(var(--sky))] transition-colors duration-200"
              >
                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">{tool.title}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
