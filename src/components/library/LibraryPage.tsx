import { useState, useEffect } from 'react';
import { getCards, deleteCard, updateCard, addCard } from '../../services/storage';
import { createDefaultCard } from '../../services/spacedRepetition';
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
  Trash2, Edit3, Volume2, Eye, Plus, X, Save, Search, Loader2, Compass, BookOpen,
} from 'lucide-react';
import { cn } from '../../utils/cn';

export function LibraryPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Card | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPrompt, setNewPrompt] = useState('');
  const [newType, setNewType] = useState<'phrase' | 'text' | 'roleplay'>('phrase');
  const { speak, isLoading: ttsLoading } = useTTS();

  useEffect(() => { loadCards(); }, []);

  const loadCards = () => setCards(getCards());

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteCard(deleteTarget.id);
    loadCards();
    if (selectedCard?.id === deleteTarget.id) setSelectedCard(null);
    setDeleteTarget(null);
  };

  const handleEdit = (card: Card) => {
    setEditingCard(card);
    setEditPrompt(card.prompt);
  };

  const handleSaveEdit = () => {
    if (!editingCard) return;
    updateCard({ ...editingCard, prompt: editPrompt });
    setEditingCard(null);
    loadCards();
  };

  const handleAddManual = () => {
    if (!newPrompt.trim()) return;
    addCard(createDefaultCard({ type: newType, prompt: newPrompt.trim() }));
    setNewPrompt('');
    setShowAddForm(false);
    loadCards();
  };

  const handleScheduleReview = (card: Card) => {
    updateCard({ ...card, nextReviewAt: new Date().toISOString() });
    loadCards();
  };

  const filteredCards = cards.filter(c =>
    c.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.type && c.type.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (selectedCard) {
    return <CardDetail card={selectedCard} onBack={() => { setSelectedCard(null); loadCards(); }} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-ink text-balance">Library</h2>
          <p className="text-ink-muted mt-0.5 tabular-nums text-sm">{cards.length} cards saved</p>
        </div>
        <Button
          variant={showAddForm ? 'ghost' : 'coral'}
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? <X size={16} /> : <Plus size={16} />}
          {showAddForm ? 'Cancel' : 'Add Card'}
        </Button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-card rounded-[20px] p-5 space-y-4 shadow-[var(--shadow-md)]">
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-1.5">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['phrase', 'text', 'roleplay'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setNewType(t)}
                  className={cn(
                    'py-2 rounded-xl text-sm font-semibold transition-all capitalize',
                    newType === t
                      ? 'bg-sky text-white shadow-[var(--shadow-sm)]'
                      : 'bg-card-warm text-ink-muted hover:text-ink-secondary',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            label="Prompt (Portuguese)"
            value={newPrompt}
            onChange={e => setNewPrompt(e.target.value)}
            placeholder="Enter the prompt in Portuguese..."
            rows={3}
          />
          <Button
            variant="coral"
            size="default"
            onClick={handleAddManual}
            disabled={!newPrompt.trim()}
            className="w-full rounded-xl"
          >
            <Save size={16} />
            Save Card
          </Button>
        </div>
      )}

      {/* Search */}
      <Input
        icon={<Search size={18} />}
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="Search cards..."
      />

      {/* Dialogs */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={open => { if (!open) setDeleteTarget(null); }}
        title="Delete card"
        description="This action cannot be undone. The card and its review history will be permanently removed."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
      />

      <Dialog open={!!editingCard} onOpenChange={open => { if (!open) setEditingCard(null); }}>
        <Dialog.Title>Edit Card</Dialog.Title>
        <div className="mt-4">
          <Textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)} rows={4} />
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <Button variant="secondary" onClick={() => setEditingCard(null)}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveEdit}>Save</Button>
        </div>
      </Dialog>

      {/* Card list / empty state */}
      {filteredCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="size-20 bg-sky-soft rounded-full flex items-center justify-center">
            <BookOpen size={36} className="text-sky" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold text-ink text-balance">No cards yet</p>
            <p className="text-sm text-ink-muted text-pretty max-w-xs mx-auto">
              Practice in Discovery mode and save cards here to review later!
            </p>
          </div>
          <a href="/">
            <Button variant="primary" size="default">
              <Compass size={16} />
              Go to Discovery
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
                className="bg-card rounded-2xl p-4 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge className="capitalize">{card.type}</Badge>
                      {card.nextReviewAt && new Date(card.nextReviewAt) <= new Date() && (
                        <Badge variant="warning">Due</Badge>
                      )}
                    </div>
                    <p className="text-ink text-sm line-clamp-2 leading-relaxed">{card.prompt}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-ink-muted">
                      <span className="tabular-nums">{stats.totalReviews} reviews</span>
                      <span className="tabular-nums">{stats.correctCount} correct</span>
                      <span className="tabular-nums">avg {stats.averageScore || '-'}</span>
                    </div>
                  </div>
                  {card.latestEvaluation && (
                    <ScoreDisplay score={card.latestEvaluation.score} size="sm" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-edge">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCard(card)} className="text-sky">
                    <Eye size={14} />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => speak(card.latestEvaluation?.correctedVersion || card.prompt)}
                    disabled={ttsLoading}
                    aria-label="Listen to card"
                  >
                    {ttsLoading ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(card)}>
                    <Edit3 size={14} />
                  </Button>
                  {!card.nextReviewAt && (
                    <Button variant="ghost" size="sm" onClick={() => handleScheduleReview(card)} className="text-sky text-xs">
                      + Review
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(card)}
                    aria-label="Delete card"
                    className="ml-auto text-danger hover:bg-danger-soft"
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
