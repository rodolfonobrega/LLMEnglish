/**
 * SessionIntentSheet — Phase 8 (F-P8-01).
 *
 * Student-facing entry point to declare a `SessionIntent`: theme,
 * vocabulary, modality, difficulty, quick-practice toggle, free-text
 * note. Reads and writes via `useSessionIntent()` so every surface
 * stays in sync without prop drilling.
 */

import { useEffect, useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { useSessionIntent } from '../../hooks/useSessionIntent';
import type { Modality, SessionIntent } from '../../types/master';
import { Flame, Timer, Zap } from 'lucide-react';

interface SessionIntentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DIFFICULTY_OPTIONS: Array<{ id: SessionIntent['requested_difficulty']; label: string }> = [
  { id: 'easier', label: 'Mais fácil' },
  { id: 'normal', label: 'Normal' },
  { id: 'harder', label: 'Mais difícil' },
];

const MODALITY_OPTIONS: Array<{ id: Modality; label: string }> = [
  { id: 'phrase', label: 'Frases' },
  { id: 'text', label: 'Texto' },
  { id: 'roleplay', label: 'Diálogo' },
  { id: 'live', label: 'Ao vivo' },
  { id: 'cloze', label: 'Cloze' },
  { id: 'listening', label: 'Escuta dirigida' },
];

export function SessionIntentSheet({ open, onOpenChange }: SessionIntentSheetProps) {
  const { intent, setIntent } = useSessionIntent();
  const [theme, setTheme] = useState('');
  const [vocabRaw, setVocabRaw] = useState('');
  const [pattern, setPattern] = useState('');
  const [modality, setModality] = useState<Modality | ''>('');
  const [difficulty, setDifficulty] = useState<SessionIntent['requested_difficulty'] | ''>('');
  const [note, setNote] = useState('');
  const [quickPractice, setQuickPractice] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTheme(intent?.requested_theme ?? '');
    setVocabRaw((intent?.requested_vocabulary ?? []).join(', '));
    setPattern(intent?.requested_pattern ?? '');
    setModality((intent?.requested_modality ?? '') as Modality | '');
    setDifficulty((intent?.requested_difficulty ?? '') as SessionIntent['requested_difficulty'] | '');
    setNote(intent?.note ?? '');
    setQuickPractice(!!intent?.quick_practice);
  }, [open, intent]);

  const handleSave = () => {
    const vocab = vocabRaw
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const next: Partial<SessionIntent> = {
      requested_theme: theme.trim() || undefined,
      requested_vocabulary: vocab.length > 0 ? vocab : undefined,
      requested_pattern: pattern.trim() || undefined,
      requested_modality: (modality || undefined) as Modality | undefined,
      requested_difficulty: (difficulty || undefined) as SessionIntent['requested_difficulty'] | undefined,
      note: note.trim() || undefined,
      quick_practice: quickPractice,
    };
    setIntent(next);
    onOpenChange(false);
  };

  const handleClear = () => {
    setIntent(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Title>O que você quer praticar?</Dialog.Title>
      <p className="text-sm text-muted-foreground mt-1">
        Suas escolhas guiam o próximo exercício. O Master respeita seus
        pedidos e só ajusta o que você não pediu.
      </p>

      <div className="mt-4 space-y-4">
        <Input
          label="Tema"
          placeholder="ex: viagens, entrevista de emprego, cozinha"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        />

        <Input
          label="Palavras ou expressões"
          placeholder="ex: overwhelmed, get used to, look forward to"
          value={vocabRaw}
          onChange={(e) => setVocabRaw(e.target.value)}
        />

        <Input
          label="Padrão gramatical (opcional)"
          placeholder="ex: past continuous, subjuntivo"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
        />

        <div>
          <label className="block text-sm font-semibold text-muted-foreground mb-1.5">
            Modalidade
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setModality('')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer',
                modality === ''
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-accent',
              )}
            >
              Qualquer
            </button>
            {MODALITY_OPTIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModality(m.id)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer',
                  modality === m.id
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground hover:bg-accent',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-muted-foreground mb-1.5">
            Dificuldade
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTY_OPTIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDifficulty((cur) => (cur === d.id ? '' : (d.id as SessionIntent['requested_difficulty'])))}
                className={cn(
                  'py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                  difficulty === d.id
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground hover:bg-accent',
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <Textarea
          label="Anotação (opcional)"
          placeholder="ex: hoje quero foco em fluência, não em gramática"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />

        <button
          type="button"
          onClick={() => setQuickPractice((v) => !v)}
          className={cn(
            'w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer',
            quickPractice
              ? 'border-primary bg-primary-soft'
              : 'border-border bg-card hover:bg-accent',
          )}
        >
          <div
            className={cn(
              'size-10 rounded-full flex items-center justify-center',
              quickPractice ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
            )}
          >
            {quickPractice ? <Zap size={18} /> : <Timer size={18} />}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">Modo rápido</div>
            <div className="text-xs text-muted-foreground">
              {quickPractice
                ? 'Master fica em silêncio — sem sugestões, sem reflexões.'
                : 'Ative para esta sessão não ter nudges do Master.'}
            </div>
          </div>
          {quickPractice && <Flame size={16} className="text-primary" />}
        </button>
      </div>

      <div className="flex gap-3 justify-end mt-6">
        <Button variant="ghost" onClick={handleClear}>
          Limpar
        </Button>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Salvar
        </Button>
      </div>
    </Dialog>
  );
}
