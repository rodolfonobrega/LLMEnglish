import type { Source, ModelOption } from '../../types/settings';
import { SOURCE_LABELS } from '../../types/settings';
import { Select } from '../ui/Select';

/** Two-dropdown model selector: Provider → Model (filtered by provider). */
export function ModelSelect({
  sources,
  models,
  currentSource,
  currentModel,
  onSourceChange,
  onModelChange,
  label,
}: {
  sources: readonly Source[];
  models: readonly ModelOption[];
  currentSource: Source;
  currentModel: string;
  onSourceChange: (source: Source) => void;
  onModelChange: (source: Source, model: string) => void;
  label: string;
}) {
  const filteredModels = models.filter(m => m.source === currentSource);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Select
        label={`${label} - Provedor`}
        value={currentSource}
        options={sources.map(s => ({ value: s, label: SOURCE_LABELS[s] }))}
        onChange={v => onSourceChange(v as Source)}
      />
      <Select
        label={`${label} - Modelo`}
        value={currentModel}
        options={filteredModels.map(m => ({ value: m.value, label: m.label }))}
        onChange={v => onModelChange(currentSource, v)}
      />
    </div>
  );
}
