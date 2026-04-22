import { useState, useEffect } from 'react';
import {
  saveModelConfig,
  saveConversationTone,
  saveApiKeys,
} from '../../services/storage';
import { useAuth } from '../../contexts/AuthContext';
import { useRuntimeConfig } from '../../contexts/RuntimeConfigContext';
import type { ModelConfig, ConversationTone } from '../../types/settings';
import { DEFAULT_MODEL_CONFIG, normalizeTtsVoice } from '../../types/settings';
import { Shield, Save, Check, Loader2, Sparkles, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { ApiKeysSection } from './sections/ApiKeysSection';
import { ProfileSection } from './sections/ProfileSection';
import { ModelConfigSection } from './sections/ModelConfigSection';
import { MasterModelSection } from './sections/MasterModelSection';
import { CostDashboardSection } from './sections/CostDashboardSection';
import { SignOutButton } from './sections/AppearanceSection';
import { AlertDialog } from '../ui/AlertDialog';
import { masterEnabled } from '../../services/runtimeConfigSnapshot';
import { resetLearnerModel } from '../../services/learnerModel';
import { updateProfile } from '../../services/supabase/auth';

export function SettingsPage() {
  const { user, profile, signOut: authSignOut, refreshProfile } = useAuth();
  const { modelConfig: rtModelConfig, conversationTone: rtTone, credentials: rtCredentials, setModelConfig, setConversationTone, hydrate } = useRuntimeConfig();
  const isDevMode = !import.meta.env.VITE_SUPABASE_URL;
  const [openaiKey, setOpenaiKeyState] = useState(rtCredentials.openai || '');
  const [geminiKey, setGeminiKeyState] = useState(rtCredentials.genai || '');
  const [groqKey, setGroqKeyState] = useState(rtCredentials.groq || '');
  const [openrouterKey, setOpenrouterKeyState] = useState(rtCredentials.openrouter || '');
  const [vertexProjectId, setVertexProjectId] = useState('');
  const [vertexRegion, setVertexRegion] = useState('us-central1');
  const [config, setConfig] = useState<ModelConfig>({ ...rtModelConfig });
  const [tone, setTone] = useState<ConversationTone>(rtTone);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [lessonsOptIn, setLessonsOptIn] = useState<boolean>(true);
  const [lessonsOptInSaving, setLessonsOptInSaving] = useState(false);
  const [reflectionsOptIn, setReflectionsOptIn] = useState<boolean>(true);
  const [reflectionsOptInSaving, setReflectionsOptInSaving] = useState(false);
  const showMasterSection = masterEnabled();

  useEffect(() => {
    // `null` is treated as opt-in (default) to preserve backward-compat.
    setLessonsOptIn(profile?.lessons_opt_in !== false);
  }, [profile?.lessons_opt_in]);

  useEffect(() => {
    setReflectionsOptIn(profile?.reflections_opt_in !== false);
  }, [profile?.reflections_opt_in]);

  const handleLessonsOptInChange = async (next: boolean) => {
    setLessonsOptIn(next);
    setLessonsOptInSaving(true);
    try {
      await updateProfile({ lessons_opt_in: next });
      await refreshProfile();
    } catch (error) {
      console.error('Error updating lessons_opt_in:', error);
      setLessonsOptIn(!next);
    } finally {
      setLessonsOptInSaving(false);
    }
  };

  const handleReflectionsOptInChange = async (next: boolean) => {
    setReflectionsOptIn(next);
    setReflectionsOptInSaving(true);
    try {
      await updateProfile({ reflections_opt_in: next });
      await refreshProfile();
    } catch (error) {
      console.error('Error updating reflections_opt_in:', error);
      setReflectionsOptIn(!next);
    } finally {
      setReflectionsOptInSaving(false);
    }
  };

  // Sync local form state from the runtime config context whenever it
  // changes (e.g. after hydration completes or after a save + re-hydrate).
  useEffect(() => {
    setConfig({
      ...rtModelConfig,
      ttsVoice: normalizeTtsVoice(rtModelConfig.ttsSource, rtModelConfig.ttsModel, rtModelConfig.ttsVoice),
      ttsFallbackVoice: rtModelConfig.ttsFallbackSource && rtModelConfig.ttsFallbackModel
        ? normalizeTtsVoice(rtModelConfig.ttsFallbackSource, rtModelConfig.ttsFallbackModel, rtModelConfig.ttsFallbackVoice)
        : undefined,
    });
    setTone(rtTone);
    setOpenaiKeyState(rtCredentials.openai || '');
    setGeminiKeyState(rtCredentials.genai || '');
    setGroqKeyState(rtCredentials.groq || '');
    setOpenrouterKeyState(rtCredentials.openrouter || '');
  }, [rtModelConfig, rtTone, rtCredentials]);

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

  const handleMasterReset = async () => {
    if (!showMasterSection) return;
    setResetting(true);
    setResetError(null);
    try {
      await resetLearnerModel('manual reset from settings');
      setResetDone(true);
      setTimeout(() => setResetDone(false), 4000);
    } catch (error) {
      console.error('Error resetting learner model:', error);
      setResetError('Erro ao resetar tutor. Tente novamente.');
    } finally {
      setResetting(false);
      setResetOpen(false);
    }
  };

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

      {showMasterSection && (
        <MasterModelSection config={config} onConfigChange={updateConfig} />
      )}

      <CostDashboardSection />

      {showMasterSection && (
        <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <Sparkles size={16} className="text-accent" />
            </div>
            <div className="flex-1">
              <h4 className="text-foreground font-bold text-sm">Tutor Adaptativo</h4>
              <p className="text-muted-foreground text-xs mt-1 text-pretty">
                O tutor silencioso aprende com seus exercícios para personalizar a prática.
                Resetar apaga o modelo atual e começa de novo em modo diagnóstico.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResetOpen(true)}
            disabled={resetting}
            className="w-full"
          >
            {resetting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RotateCcw size={16} />
            )}
            {resetting ? 'Resetando...' : 'Resetar meu tutor'}
          </Button>

          <label className="flex items-center justify-between gap-3 pt-2 border-t border-border">
            <span className="text-sm text-foreground">
              Permitir atividades sugeridas pelo tutor
              <span className="block text-xs text-muted-foreground mt-0.5">
                Quando desligado, você não recebe atividades montadas automaticamente.
              </span>
            </span>
            <input
              type="checkbox"
              checked={lessonsOptIn}
              onChange={(e) => handleLessonsOptInChange(e.target.checked)}
              disabled={lessonsOptInSaving}
              data-testid="lessons-opt-in-toggle"
              className="size-5 accent-primary cursor-pointer disabled:cursor-wait"
            />
          </label>

          <label className="flex items-center justify-between gap-3 pt-2 border-t border-border">
            <span className="text-sm text-foreground">
              Receber reflexões ao fim da sessão
              <span className="block text-xs text-muted-foreground mt-0.5">
                Pequena mensagem sobre como você falou hoje e o que praticar na próxima.
              </span>
            </span>
            <input
              type="checkbox"
              checked={reflectionsOptIn}
              onChange={(e) => handleReflectionsOptInChange(e.target.checked)}
              disabled={reflectionsOptInSaving}
              data-testid="reflections-opt-in-toggle"
              className="size-5 accent-primary cursor-pointer disabled:cursor-wait"
            />
          </label>
          {resetDone && (
            <div className="rounded-xl border border-leaf/30 bg-leaf-soft px-3 py-2 text-xs font-medium text-leaf">
              Tutor resetado com sucesso.
            </div>
          )}
          {resetError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {resetError}
            </div>
          )}
        </div>
      )}

      <AlertDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Resetar tutor adaptativo?"
        description="Esta ação apaga o modelo de aprendizado atual e reinicia o tutor em modo diagnóstico. Seu histórico de exercícios e cards é preservado, apenas o perfil adaptativo é zerado."
        confirmLabel="Resetar"
        cancelLabel="Cancelar"
        onConfirm={handleMasterReset}
      />

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
