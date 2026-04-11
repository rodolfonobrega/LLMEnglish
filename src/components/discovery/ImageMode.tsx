import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, X, ImageIcon, Sparkles, RotateCcw, ChevronLeft } from 'lucide-react';
import { AudioRecorder } from '../shared/AudioRecorder';
import { EvaluationResults } from '../shared/EvaluationResults';
import { chatCompletion, chatCompletionWithImage, generateImage, speechToText } from '../../services/openai';
import { getImageConfigAuto, BASE_IMAGE_STYLE_PROMPT } from '../../config/images';
import { getImageQuestionPrompt, getEvaluationPrompt } from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import { createDefaultCard } from '../../services/spacedRepetition';
import { addCard, getConversationTone } from '../../services/storage';
import { addXP, syncGamificationState } from '../../services/gamification';
import { XP_PER_EXERCISE, XP_PER_PERFECT_SCORE } from '../../types/gamification';
import type { EvaluationResult } from '../../types/card';
import type { ConversationTone } from '../../types/settings';
import { Button } from '../ui/Button';
import { Skeleton, SkeletonText } from '../ui/Skeleton';

export function ImageMode() {
  const navigate = useNavigate();
  const [imageUrl, setImageUrl] = useState('');
  const [question, setQuestion] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [userAudioBase64, setUserAudioBase64] = useState<string | null>(null);
  const [tone, setTone] = useState<ConversationTone>('balanced');

  useEffect(() => {
    setTone(getConversationTone());
  }, []);

  const generateImageAndQuestion = async () => {
    setIsGenerating(true);
    setError(null);
    setEvaluation(null);
    setSaved(false);
    setUserAudioBase64(null);
    try {
      const imgUrl = await generateImage(
        `${BASE_IMAGE_STYLE_PROMPT} A highly detailed, immersive everyday scene that would be interesting to describe: ` +
        ['a bustling street market with distinct colorful stalls', 'a cozy, warm-lit coffee shop interior', 'a lively park on a clear sunny day', 'a busy airport terminal with diverse travelers', 'a busy authentic kitchen with food being prepared', 'a beautiful, relaxing beach scene at midday', 'a dazzling city skyline at sunset'][
        Math.floor(Math.random() * 7)
        ],
        getImageConfigAuto('imageMode')
      );
      setImageUrl(imgUrl);

      const questionPrompt = getImageQuestionPrompt(tone);
      const q = await chatCompletionWithImage(questionPrompt, imgUrl);
      setQuestion(q.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAudioReady = async (blob: Blob, base64: string) => {
    setIsEvaluating(true);
    setError(null);
    setUserAudioBase64(base64);
    try {
      const transcription = await speechToText(blob);
      const evalPrompt = getEvaluationPrompt(question, transcription, 'image description', tone);
      const evalResponse = await chatCompletion('You are an expert English language evaluator. Respond only with valid JSON.', evalPrompt);
      const cleanResponse = cleanJson(evalResponse);
      const evalResult: EvaluationResult = JSON.parse(cleanResponse);
      evalResult.userTranscription = transcription;
      setEvaluation(evalResult);

      let xp = XP_PER_EXERCISE;
      if (evalResult.score >= 9) xp += XP_PER_PERFECT_SCORE;
      await addXP(xp);
      await syncGamificationState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!evaluation) return;
    const card = createDefaultCard({
      type: 'image',
      prompt: question,
      imageUrl,
      latestEvaluation: evaluation,
      userAudioBlob: userAudioBase64 || undefined,
    });
    await addCard(card)
    await syncGamificationState()
    setSaved(true);
  };

  const reset = () => {
    setImageUrl('');
    setQuestion('');
    setEvaluation(null);
    setError(null);
    setSaved(false);
    setUserAudioBase64(null);
  };

  const retrySame = () => {
    setEvaluation(null);
    setError(null);
    setSaved(false);
    setUserAudioBase64(null);
    // Keep imageUrl and question intact — user sees same image and question again
  };

  return (
    <div className="space-y-6">
      {/* Start button */}
      {!imageUrl && !isGenerating && (
        <div className="text-center space-y-4">
          <div className="bg-muted rounded-2xl p-8">
            <div className="size-16 bg-primary-soft rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon size={32} className="text-primary" />
            </div>
            <p className="text-foreground font-bold text-lg mb-1">Desafio Visual</p>
            <p className="text-muted-foreground text-sm text-pretty max-w-sm mx-auto">
              Descreva em inglês o que você vê na imagem gerada por IA. Ótimo para treinar vocabulário descritivo!
            </p>
          </div>
          <Button variant="coral" size="lg" onClick={generateImageAndQuestion} disabled={isGenerating} className="w-full text-lg font-bold py-4 rounded-2xl">
            <Sparkles size={20} />
            Gerar Desafio Visual
          </Button>
        </div>
      )}

      {/* Loading skeleton */}
      {isGenerating && !imageUrl && (
        <div className="space-y-4">
          <Skeleton className="aspect-video w-full rounded-2xl" />
          <div className="bg-card rounded-2xl p-5 border border-border">
            <SkeletonText lines={2} />
          </div>
        </div>
      )}

      {/* Image + Task */}
      {imageUrl && !evaluation && (
        <div className="space-y-6">
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-border">
              <img src={imageUrl} alt="Challenge image to describe" className="w-full aspect-video object-cover" />
            </div>
            <button
              onClick={reset}
              aria-label="Dismiss prompt"
              className="absolute top-3 right-3 size-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-7 rounded-full bg-primary-soft flex items-center justify-center">
                <ImageIcon size={14} className="text-primary" />
              </div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wide">Sua Tarefa</p>
            </div>
            <p className="text-lg text-foreground text-pretty leading-relaxed">{question}</p>
          </div>

          <AudioRecorder onAudioReady={handleAudioReady} disabled={isEvaluating} />

          {isEvaluating && (
            <div className="flex items-center justify-center gap-2 text-primary">
              <Loader2 size={20} className="animate-spin" />
              <span className="font-medium">Avaliando sua descrição...</span>
            </div>
          )}
        </div>
      )}

      {/* Evaluation */}
      {evaluation && (
        <div className="space-y-5">
          {imageUrl && (
            <div className="overflow-hidden rounded-2xl border border-border">
              <img src={imageUrl} alt="Challenge image" className="w-full max-h-48 object-cover" />
            </div>
          )}
          <div className="bg-card rounded-2xl p-4 border border-border">
            <p className="text-xs text-muted-foreground uppercase mb-1 font-bold tracking-wide">Tarefa</p>
            <p className="text-foreground text-pretty">{question}</p>
          </div>
          <EvaluationResults result={evaluation} onSaveToLibrary={() => { void handleSaveToLibrary() }} showSaveButton={!saved} />
          {saved && (
            <div className="bg-leaf-soft rounded-2xl p-4 text-center">
              <p className="text-leaf font-bold">Salvo na Biblioteca!</p>
            </div>
          )}
          <div className="space-y-2">
            <Button variant="primary" size="lg" onClick={retrySame} className="w-full rounded-2xl cursor-pointer">
              <RotateCcw size={18} />
              Tentar Novamente
            </Button>
            <Button variant="secondary" size="lg" onClick={reset} className="w-full rounded-2xl cursor-pointer">
              <RefreshCw size={18} />
              Novo Exercicio
            </Button>
            <Button variant="ghost" size="lg" onClick={() => navigate('/practice')} className="w-full rounded-2xl cursor-pointer">
              <ChevronLeft size={18} />
              Voltar ao Hub
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-2xl p-4 text-[var(--danger)] text-sm">{error}</div>
      )}
    </div>
  );
}
