import { KeyRound } from 'lucide-react';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { cn } from '../../../utils/cn';

export interface ApiKeysSectionProps {
  isDevMode: boolean;
  openaiKey: string;
  geminiKey: string;
  groqKey: string;
  openrouterKey: string;
  vertexProjectId: string;
  vertexRegion: string;
  onOpenaiKeyChange: (value: string) => void;
  onGeminiKeyChange: (value: string) => void;
  onGroqKeyChange: (value: string) => void;
  onOpenrouterKeyChange: (value: string) => void;
  onVertexProjectIdChange: (value: string) => void;
  onVertexRegionChange: (value: string) => void;
}

export function ApiKeysSection({
  isDevMode,
  openaiKey,
  geminiKey,
  groqKey,
  openrouterKey,
  vertexProjectId,
  vertexRegion,
  onOpenaiKeyChange,
  onGeminiKeyChange,
  onGroqKeyChange,
  onOpenrouterKeyChange,
  onVertexProjectIdChange,
  onVertexRegionChange,
}: ApiKeysSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="size-7 rounded-full bg-primary-soft flex items-center justify-center">
          <KeyRound size={14} className="text-primary" />
        </div>
        <h3 className="text-sm font-bold text-primary uppercase tracking-wide">API Keys</h3>
      </div>

      <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
        {isDevMode && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              API keys loaded from environment variables. Sign in to manage your own keys.
            </p>
          </div>
        )}
        <Input
          label="OpenAI API Key"
          type="password"
          value={openaiKey}
          onChange={e => onOpenaiKeyChange(e.target.value)}
          placeholder="sk-..."
          disabled={isDevMode}
          className={cn(isDevMode && 'opacity-50 cursor-not-allowed')}
          hint={import.meta.env.VITE_OPENAI_API_KEY && !localStorage.getItem('el_openai_key')
            ? 'Carregada do arquivo .env'
            : 'Obtenha em platform.openai.com/api-keys'}
        />
        <Input
          label="Google Gemini API Key"
          type="password"
          value={geminiKey}
          onChange={e => onGeminiKeyChange(e.target.value)}
          placeholder="AI..."
          disabled={isDevMode}
          className={cn(isDevMode && 'opacity-50 cursor-not-allowed')}
          hint={import.meta.env.VITE_GEMINI_API_KEY && !localStorage.getItem('el_gemini_key')
            ? 'Carregada do arquivo .env'
            : 'Obtenha em aistudio.google.com/apikey'}
        />
        <Input
          label="Groq API Key"
          type="password"
          value={groqKey}
          onChange={e => onGroqKeyChange(e.target.value)}
          placeholder="gsk_..."
          disabled={isDevMode}
          className={cn(isDevMode && 'opacity-50 cursor-not-allowed')}
          hint={import.meta.env.VITE_GROQ_API_KEY && !localStorage.getItem('el_groq_key')
            ? 'Carregada do arquivo .env'
            : 'Obtenha em console.groq.com'}
        />
        <Input
          label="OpenRouter API Key"
          type="password"
          value={openrouterKey}
          onChange={e => onOpenrouterKeyChange(e.target.value)}
          placeholder="sk-or-..."
          disabled={isDevMode}
          className={cn(isDevMode && 'opacity-50 cursor-not-allowed')}
          hint={import.meta.env.VITE_OPENROUTER_API_KEY && !localStorage.getItem('el_openrouter_key')
            ? 'Carregada do arquivo .env'
            : 'Obtenha em openrouter.ai/keys'}
        />
        <div className="pt-3 border-t border-border/50 space-y-3">
          <p className="text-sm font-medium text-foreground">Vertex AI (Google Cloud)</p>
          <p className="text-xs text-muted-foreground">No API key needed. Uses your Google Cloud project credentials.</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Project ID"
              type="text"
              value={vertexProjectId}
              onChange={e => onVertexProjectIdChange(e.target.value)}
              placeholder="my-gcp-project"
              disabled={isDevMode}
              className={cn(isDevMode && 'opacity-50 cursor-not-allowed')}
              hint="Google Cloud project ID"
            />
            <Select
              label="Region"
              value={vertexRegion}
              onChange={v => onVertexRegionChange(v)}
              options={[
                { value: 'us-central1', label: 'us-central1 (Iowa)' },
                { value: 'us-east1', label: 'us-east1 (South Carolina)' },
                { value: 'europe-west1', label: 'europe-west1 (Belgium)' },
                { value: 'europe-west4', label: 'europe-west4 (Netherlands)' },
                { value: 'asia-east1', label: 'asia-east1 (Taiwan)' },
                { value: 'asia-southeast1', label: 'asia-southeast1 (Singapore)' },
              ]}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
