import { useState, useEffect } from 'react';
import { getCards, deleteCard, updateCard, addCard } from '../../services/storage';
import { createDefaultCard } from '../../services/spacedRepetition';
import { syncGamificationState } from '../../services/gamification';
import { computeReviewStats } from '../../types/review';
import type { Card } from '../../types/card';
import { useTTS } from '../../hooks/useTTS';
import { CardDetail } from './CardDetail';
import { ScoreDisplay } from '../shared/ScoreDisplay';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Badge } from '../ui/Badge';
import { Dialog } from '../ui/Dialog';
import { AlertDialog } from '../ui/AlertDialog';
import {
  Trash2, Edit3, Volume2, Eye, Plus, X, Save, Search, Loader2, Compass, BookOpen, Pin,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useSessionIntent } from '../../hooks/useSessionIntent';
import { MasterRecommendations } from './MasterRecommendations';

export function LibraryPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Card | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPrompt, setNewPrompt] = useState('');
  const [newType, setNewType] = useState<'phrase' | 'text' | 'roleplay'>('phrase');
  const { speak, isLoading: ttsLoading } = useTTS();
  const { intent, setIntent } = useSessionIntent();
  const pinnedIds = new Set(intent?.review_focus ?? []);

  useEffect(() => {
    void loadCards()
  }, []);

  const loadCards = async () => {
    setIsLoading(true)
    setCards(await getCards())
    setIsLoading(false)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteCard(deleteTarget.id)
    await syncGamificationState()
    await loadCards()
    if (selectedCard?.id === deleteTarget.id) setSelectedCard(null);
    setDeleteTarget(null);
  };

  const handleEdit = (card: Card) => {
    setEditingCard(card);
    setEditPrompt(card.prompt);
  };

  const handleSaveEdit = async () => {
    if (!editingCard) return;
    await updateCard({ ...editingCard, prompt: editPrompt })
    setEditingCard(null);
    await loadCards()
  };

  const handleAddManual = async () => {
    if (!newPrompt.trim()) return;
    await addCard(createDefaultCard({ type: newType, prompt: newPrompt.trim() }))
    await syncGamificationState()
    setNewPrompt('');
    setShowAddForm(false);
    await loadCards()
  };

  const handleScheduleReview = async (card: Card) => {
    await updateCard({ ...card, nextReviewAt: new Date().toISOString() })
    await loadCards()
  };

  const handleTogglePin = (card: Card) => {
    const already = pinnedIds.has(card.id);
    const nextFocus = already
      ? (intent?.review_focus ?? []).filter((id) => id !== card.id)
      : [...(intent?.review_focus ?? []), card.id];
    if (nextFocus.length === 0 && !intent?.requested_theme && !intent?.requested_vocabulary?.length) {
      setIntent({ review_focus: [] });
    } else {
      setIntent({ review_focus: nextFocus });
    }
  };

  const filteredCards = cards.filter(c =>
    c.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.type && c.type.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (selectedCard) {
    return <CardDetail card={selectedCard} onBack={() => { setSelectedCard(null); void loadCards(); }} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground text-balance">Seus Flashcards</h2>
          <p className="text-muted-foreground mt-0.5 tabular-nums text-sm">{cards.length} cards salvos</p>
        </div>
        <Button
          variant={showAddForm ? 'ghost' : 'coral'}
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? <X size={16} /> : <Plus size={16} />}
          {showAddForm ? 'Cancelar' : 'Adicionar Card'}
        </Button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-card rounded-2xl p-5 space-y-4 border border-border">
          <div>
            <label className="block text-sm font-semibold text-muted-foreground mb-1.5">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {([['phrase', 'Frase'], ['text', 'Texto'], ['roleplay', 'Situação']] as const).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setNewType(t)}
                  className={cn(
                    'py-2 rounded-xl text-sm font-semibold transition-colors duration-200 cursor-pointer',
                    newType === t
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            label="Prompt (Português)"
            value={newPrompt}
            onChange={e => setNewPrompt(e.target.value)}
            placeholder="Digite o prompt em português..."
            rows={3}
          />
          <Button
            variant="coral"
            size="default"
            onClick={() => { void handleAddManual() }}
            disabled={!newPrompt.trim()}
            className="w-full rounded-xl"
          >
            <Save size={16} />
            Salvar Card
          </Button>
        </div>
      )}

      {/* Phase 4 (F-P4-01) — Master recommendations from chronic errors.
          Hidden when the Master is disabled or when there are no matching
          cards for the student's current chronic patterns. */}
      <MasterRecommendations
        cards={cards}
        onSelectCard={setSelectedCard}
        onCardsChanged={loadCards}
      />

      {/* Search */}
      <Input
        icon={<Search size={18} />}
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="Buscar cards..."
      />

      {/* Dialogs */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={open => { if (!open) setDeleteTarget(null); }}
        title="Excluir card"
        description="Esta ação não pode ser desfeita. O card e seu histórico de revisão serão removidos permanentemente."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={() => { void handleDeleteConfirm() }}
      />

      <Dialog open={!!editingCard} onOpenChange={open => { if (!open) setEditingCard(null); }}>
        <Dialog.Title>Editar Card</Dialog.Title>
        <div className="mt-4">
          <Textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)} rows={4} />
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <Button variant="secondary" onClick={() => setEditingCard(null)}>Cancelar</Button>
          <Button variant="primary" onClick={() => { void handleSaveEdit() }}>Salvar</Button>
        </div>
      </Dialog>

      {/* Card list / empty state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 size={18} className="animate-spin mr-2" />
          Carregando cards...
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="size-20 bg-primary-soft rounded-full flex items-center justify-center">
            <BookOpen size={36} className="text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold text-foreground text-balance">Nenhum card ainda</p>
            <p className="text-sm text-muted-foreground text-pretty max-w-xs mx-auto">
              Pratique nos Exercícios e salve cards aqui para revisar depois!
            </p>
          </div>
          <a href="/">
            <Button variant="primary" size="default" className="cursor-pointer">
              <Compass size={16} />
              Ir para Exercícios
            </Button>
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCards.map(card => {
            const stats = computeReviewStats(card.reviews);
            return (
              <div
                key={card.id}
                className="bg-card rounded-2xl p-4 border border-border hover:bg-accent transition-colors duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge className="capitalize">{card.type}</Badge>
                      {card.nextReviewAt && new Date(card.nextReviewAt) <= new Date() && (
                        <Badge variant="warning">Pendente</Badge>
                      )}
                    </div>
                    <p className="text-foreground text-sm line-clamp-2 leading-relaxed">{card.prompt}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="tabular-nums">{stats.totalReviews} revisões</span>
                      <span className="tabular-nums">{stats.correctCount} corretas</span>
                      <span className="tabular-nums">média {stats.averageScore || '-'}</span>
                    </div>
                  </div>
                  {card.latestEvaluation && (
                    <ScoreDisplay score={card.latestEvaluation.score} size="sm" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCard(card)} className="text-primary cursor-pointer">
                    <Eye size={14} />
                    Ver
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => speak(card.latestEvaluation?.correctedVersion || card.prompt)}
                    disabled={ttsLoading}
                    aria-label="Ouvir card"
                    className="cursor-pointer"
                  >
                    {ttsLoading ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(card)} className="cursor-pointer">
                    <Edit3 size={14} />
                  </Button>
                  {!card.nextReviewAt && (
                    <Button variant="ghost" size="sm" onClick={() => { void handleScheduleReview(card) }} className="text-primary text-xs cursor-pointer">
                      + Revisão
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTogglePin(card)}
                    aria-label={pinnedIds.has(card.id) ? 'Desfixar para próxima sessão' : 'Fixar para próxima sessão'}
                    className={cn(
                      'cursor-pointer',
                      pinnedIds.has(card.id) ? 'text-primary' : 'text-muted-foreground',
                    )}
                    title={pinnedIds.has(card.id) ? 'Fixado para a próxima sessão' : 'Fixar para a próxima sessão'}
                  >
                    <Pin size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(card)}
                    aria-label="Excluir card"
                    className="ml-auto text-[var(--danger)] hover:bg-[var(--danger-soft)] cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
