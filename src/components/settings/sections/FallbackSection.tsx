import { ShieldAlert } from 'lucide-react';
import type { Source, ModelOption } from '../../../types/settings';
import { SOURCE_LABELS } from '../../../types/settings';
import { Select } from '../../ui/Select';

export function FallbackSection({
  label,
  modelSources,
  modelOptions,
  currentModel,
  currentSource,
  onSourceChange,
  onModelChange,
  voiceOptions,
  currentVoice,
  onVoiceChange,
}: {
  label: string;
  modelSources: readonly Source[];
  modelOptions: readonly ModelOption[];
  currentModel: string | undefined;
  currentSource: Source | undefined;
  onSourceChange: (source: Source | '') => void;
  onModelChange: (source: Source, model: string) => void;
  voiceOptions?: { value: string; label: string }[];
  currentVoice?: string;
  onVoiceChange?: (voice: string) => void;
}) {
  const filteredModels = currentSource
    ? modelOptions.filter(m => m.source === currentSource)
    : [];
  return (
    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
      <div className="flex items-center gap-1.5">
        <ShieldAlert size={12} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Fallback - Provedor"
          value={currentSource ?? ''}
          options={[
            { value: '', label: 'Nenhum (sem fallback)' },
            ...modelSources.map(s => ({ value: s, label: SOURCE_LABELS[s] })),
          ]}
          onChange={v => onSourceChange(v as Source | '')}
        />
        <Select
          label="Fallback - Modelo"
          value={currentModel ?? ''}
          options={filteredModels.map(m => ({ value: m.value, label: m.label }))}
          onChange={v => currentSource && onModelChange(currentSource, v)}
          disabled={!currentSource}
        />
      </div>
      {voiceOptions && currentModel && onVoiceChange && (
        <Select
          label="Voz Fallback"
          value={currentVoice || ''}
          options={voiceOptions}
          onChange={onVoiceChange}
        />
      )}
    </div>
  );
}
