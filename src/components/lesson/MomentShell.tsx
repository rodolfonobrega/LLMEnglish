import { useState } from 'react';
import type { MomentSignal } from '../../types/learnerModel';
import { cn } from '../../utils/cn';

interface MomentShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  onDone: (signal: MomentSignal) => void;
  /** Allow skipping signal capture (e.g. moment 5, reveal). */
  autoAdvanceSignal?: MomentSignal;
}

/**
 * Wraps a moment's content with a minimal "how did that go?" capture form
 * that emits a `MomentSignal`. This is what the Master uses to adapt the
 * remainder of the lesson.
 */
export function MomentShell({
  title,
  description,
  children,
  onDone,
  autoAdvanceSignal,
}: MomentShellProps) {
  const [goalMet, setGoalMet] = useState<boolean | null>(null);
  const [difficulty, setDifficulty] =
    useState<MomentSignal['difficulty_actual'] | null>(null);
  const [engagement, setEngagement] =
    useState<MomentSignal['engagement_observed'] | null>(null);

  if (autoAdvanceSignal) {
    return (
      <section className="space-y-4">
        <header>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </header>
        {children}
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground"
          onClick={() => onDone(autoAdvanceSignal)}
        >
          Concluir momento
        </button>
      </section>
    );
  }

  const ready = goalMet !== null && difficulty !== null && engagement !== null;

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </header>

      {children}

      <div className="space-y-3 border-t pt-4">
        <div className="text-sm font-medium">Como foi esse momento pra você?</div>

        <Row
          label="Consegui fazer o que foi pedido"
          value={goalMet}
          onChange={setGoalMet}
          options={[
            { value: true, label: 'Sim' },
            { value: false, label: 'Ainda não' },
          ]}
        />

        <Row
          label="Dificuldade"
          value={difficulty}
          onChange={setDifficulty}
          options={[
            { value: 'easy', label: 'Tranquilo' },
            { value: 'ok', label: 'Na medida' },
            { value: 'hard', label: 'Difícil' },
          ]}
        />

        <Row
          label="Energia / engajamento"
          value={engagement}
          onChange={setEngagement}
          options={[
            { value: 'high', label: 'Alto' },
            { value: 'medium', label: 'Médio' },
            { value: 'low', label: 'Baixo' },
            { value: 'frustrated', label: 'Frustrante' },
          ]}
        />

        <button
          type="button"
          disabled={!ready}
          className={cn(
            'px-4 py-2 rounded-xl bg-primary text-primary-foreground',
            !ready && 'opacity-50 cursor-not-allowed',
          )}
          onClick={() => {
            if (!ready) return;
            onDone({
              goal_met: goalMet!,
              difficulty_actual: difficulty!,
              observed_issues: [],
              notable_successes: [],
              engagement_observed: engagement!,
            });
          }}
        >
          Próximo momento
        </button>
      </div>
    </section>
  );
}

interface RowProps<T> {
  label: string;
  value: T | null;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}

function Row<T extends string | number | boolean>({
  label,
  value,
  onChange,
  options,
}: RowProps<T>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground w-40">{label}</span>
      <div className="flex gap-2 flex-wrap">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            className={cn(
              'px-3 py-1 text-sm rounded-full border',
              value === o.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-gray-300 dark:border-gray-600',
            )}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
