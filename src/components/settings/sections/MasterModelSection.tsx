/**
 * Settings → Master per-role model configuration (Phase 5 / F-P5-03).
 *
 * Lets the user pick a specific `(source, model)` for each Master role, or
 * fall back to the main chat model. This is an advanced section: the default
 * is "inherit chat model" so the section can be safely ignored.
 *
 * Per the plan, we do NOT hide this section behind a feature flag right now —
 * the plan explicitly says "no need to hide from users yet".
 *
 * Write path: mutates `config.masterModels[role]` via `onConfigChange`.
 * - Setting role to "inherit" deletes the key (so the runtime falls back to
 *   `chatModel` / `chatSource`).
 * - Setting role to a concrete model writes `{ model, source }`.
 */
import { useMemo } from 'react';
import { Brain, RotateCcw } from 'lucide-react';
import type { ModelConfig, Source } from '../../../types/settings';
import {
  CHAT_MODELS,
  MASTER_ROLE_KEYS,
  MASTER_ROLE_LABELS,
  SOURCE_LABELS,
  sourcesFromModels,
  type MasterModelOverride,
  type MasterModelOverrides,
} from '../../../types/settings';
import { Select } from '../../ui/Select';

const CHAT_SOURCES = sourcesFromModels(CHAT_MODELS);

type RoleKey = keyof MasterModelOverrides;
const INHERIT_VALUE = '__inherit__';

function encodeModelValue(source: Source, model: string): string {
  return `${source}::${model}`;
}

function decodeModelValue(value: string): { source: Source; model: string } | null {
  if (value === INHERIT_VALUE) return null;
  const [source, ...rest] = value.split('::');
  if (!source || rest.length === 0) return null;
  return { source: source as Source, model: rest.join('::') };
}

export interface MasterModelSectionProps {
  config: ModelConfig;
  onConfigChange: (partial: Partial<ModelConfig>) => void;
}

export function MasterModelSection({ config, onConfigChange }: MasterModelSectionProps) {
  const modelOptions = useMemo(
    () => [
      { value: INHERIT_VALUE, label: 'Herdar modelo principal de chat' },
      ...CHAT_SOURCES.flatMap((source) =>
        CHAT_MODELS.filter((m) => m.source === source).map((m) => ({
          value: encodeModelValue(source, m.value),
          label: `${SOURCE_LABELS[source]} · ${m.label}`,
        })),
      ),
    ],
    [],
  );

  const effectiveSelection = (role: RoleKey): string => {
    const override = config.masterModels?.[role];
    if (override && override.model && override.source) {
      return encodeModelValue(override.source, override.model);
    }
    return INHERIT_VALUE;
  };

  const handleChange = (role: RoleKey, raw: string) => {
    const decoded = decodeModelValue(raw);
    const prev: MasterModelOverrides = config.masterModels ?? {};
    const next: MasterModelOverrides = { ...prev };
    if (decoded === null) {
      delete next[role];
    } else {
      const entry: MasterModelOverride = { model: decoded.model, source: decoded.source };
      next[role] = entry;
    }
    onConfigChange({
      masterModels: Object.keys(next).length > 0 ? next : undefined,
    });
  };

  const handleResetAll = () => {
    onConfigChange({ masterModels: undefined });
  };

  const hasAnyOverride = !!config.masterModels && Object.keys(config.masterModels).length > 0;
  const inheritedLabel = `${SOURCE_LABELS[config.chatSource]} · ${
    CHAT_MODELS.find((m) => m.value === config.chatModel && m.source === config.chatSource)?.label
      ?? config.chatModel
  }`;

  return (
    <section className="bg-card rounded-2xl p-5 border border-border space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-primary-soft flex items-center justify-center">
            <Brain size={14} className="text-primary" />
          </div>
          <h4 className="text-sm font-bold uppercase tracking-wide text-primary">
            Modelos do Tutor (avançado)
          </h4>
        </div>
        {hasAnyOverride && (
          <button
            type="button"
            onClick={handleResetAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-semibold cursor-pointer"
          >
            <RotateCcw size={12} />
            Herdar tudo
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-pretty">
        Cada papel do tutor pode usar um modelo diferente. Por padrão tudo herda o modelo
        de chat principal ({inheritedLabel}). Use modelos mais baratos para papéis frequentes
        (prescribe, render_moment) e modelos mais fortes para avaliação.
      </p>

      <div className="space-y-3">
        {MASTER_ROLE_KEYS.map((role) => (
          <div key={role} className="flex flex-col gap-1">
            <Select
              label={MASTER_ROLE_LABELS[role]}
              value={effectiveSelection(role)}
              options={modelOptions}
              onChange={(v) => handleChange(role, v)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
