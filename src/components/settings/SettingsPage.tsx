import { useState, useEffect } from 'react';
import {
  getModelConfig, saveModelConfig,
  getConversationTone, saveConversationTone,
  saveApiKeys,
} from '../../services/storage';
import { useAuth } from '../../contexts/AuthContext';
import { useRuntimeConfig } from '../../contexts/RuntimeConfigContext';
import type { ModelConfig, ConversationTone } from '../../types/settings';
import { DEFAULT_MODEL_CONFIG, normalizeTtsVoice } from '../../types/settings';
import { Shield, Save, Check, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { ApiKeysSection } from './sections/ApiKeysSection';
import { ProfileSection } from './sections/ProfileSection';
import { ModelConfigSection } from './sections/ModelConfigSection';
import { SignOutButton } from './sections/AppearanceSection';

export function SettingsPage() {
  const { user, profile, signOut: authSignOut, refreshProfile } = useAuth();
  const { setModelConfig, setConversationTone, hydrate } = useRuntimeConfig();
  const isDevMode = !import.meta.env.VITE_SUPABASE_URL;
  const [openaiKey, setOpenaiKeyState] = useState('');
  const [geminiKey, setGeminiKeyState] = useState('');
  const [groqKey, setGroqKeyState] = useState('');
  const [openrouterKey, setOpenrouterKeyState] = useState('');
  const [vertexProjectId, setVertexProjectId] = useState('');
  const [vertexRegion, setVertexRegion] = useState('us-central1');
  const [config, setConfig] = useState<ModelConfig>({ ...DEFAULT_MODEL_CONFIG });
  const [tone, setTone] = useState<ConversationTone>('balanced');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getModelConfig(),
      getConversationTone(),
    ]).then(([modelConfig, conversationTone]) => {
      setConfig({
        ...modelConfig,
        ttsVoice: normalizeTtsVoice(modelConfig.ttsSource, modelConfig.ttsModel, modelConfig.ttsVoice),
        ttsFallbackVoice: modelConfig.ttsFallbackSource && modelConfig.ttsFallbackModel
          ? normalizeTtsVoice(modelConfig.ttsFallbackSource, modelConfig.ttsFallbackModel, modelConfig.ttsFallbackVoice)
          : undefined,
      });
      setTone(conversationTone);
    });
  }, []);

  const updateConfig = (partial: Partial<ModelConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }));
  };

  const handleSave = async () => {
    if (isDevMode) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (openaiKey || geminiKey || groqKey || openrouterKey) {
        await saveApiKeys({
          openai: openaiKey || '',
          genai: geminiKey || '',
          groq: groqKey || '',
          openrouter: openrouterKey || '',
        });
      }
      await saveModelConfig(config);
      await saveConversationTone(tone);
      setModelConfig(config);
      setConversationTone(tone);
      await hydrate();
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveError('Erro ao salvar configuracoes. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await authSignOut();
    window.location.href = '/login';
  };

  const handleReset = () => setConfig({ ...DEFAULT_MODEL_CONFIG });

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      {/* Header with User Profile */}
      <div className="flex items-center justify-between">
        <div className="text-center space-y-2 flex-1">
          <h2 className="text-3xl font-extrabold text-foreground text-balance">Configurações</h2>
          <p className="text-muted-foreground text-pretty">Configure suas API keys, perfil e modelos de IA.</p>
        </div>
        <SignOutButton onLogout={handleLogout} />
      </div>

      {/* User Info Card */}
      <div className="bg-card rounded-2xl p-4 border border-border flex items-center gap-4">
        <div className="size-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg">
          {profile?.email?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{profile?.email || user?.email}</p>
          <p className="text-sm text-muted-foreground">SpeakLab sincronizado na nuvem</p>
        </div>
      </div>

      {/* Security Notice */}
      <div className="flex items-start gap-3 bg-primary-soft rounded-2xl p-4">
        <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Shield size={16} className="text-primary" />
        </div>
        <div>
          <h4 className="text-primary font-bold text-sm">Dados Sincronizados</h4>
          <p className="text-muted-foreground text-sm mt-1 text-pretty">
            Suas API keys são armazenadas de forma criptografada na nuvem. Seus dados sincronizam entre dispositivos.
          </p>
        </div>
      </div>

      <ApiKeysSection
        isDevMode={isDevMode}
        openaiKey={openaiKey}
        geminiKey={geminiKey}
        groqKey={groqKey}
        openrouterKey={openrouterKey}
        vertexProjectId={vertexProjectId}
        vertexRegion={vertexRegion}
        onOpenaiKeyChange={setOpenaiKeyState}
        onGeminiKeyChange={setGeminiKeyState}
        onGroqKeyChange={setGroqKeyState}
        onOpenrouterKeyChange={setOpenrouterKeyState}
        onVertexProjectIdChange={setVertexProjectId}
        onVertexRegionChange={setVertexRegion}
      />

      <ProfileSection tone={tone} onToneChange={setTone} />

      <ModelConfigSection config={config} onConfigChange={updateConfig} onReset={handleReset} />

      {/* Save */}
      <div className="space-y-3">
        <Button
          variant={saved ? 'primary' : 'coral'}
          size="lg"
          onClick={handleSave}
          disabled={saving}
          className={cn('w-full text-lg font-bold py-4 rounded-2xl cursor-pointer', saved && 'bg-leaf hover:bg-leaf')}
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : saved ? <Check size={20} /> : <Save size={20} />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configurações'}
        </Button>
        {saved && !saving && (
          <div className="rounded-xl border border-leaf/30 bg-leaf-soft px-4 py-3 text-sm font-medium text-leaf">
            Configurações salvas com sucesso.
          </div>
        )}
        {saveError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {saveError}
          </div>
        )}
      </div>
    </div>
  );
}
