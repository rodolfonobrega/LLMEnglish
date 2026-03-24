import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { Loader2, FileText, Download, Clapperboard } from 'lucide-react';
import { Button } from '../ui/Button';
import { chatCompletion } from '../../services/openai';
import { getConversationTone, getUserContext } from '../../services/supabase/storage';
import { getCustomDialoguePrompt } from '../../utils/prompts';
import type { ConversationTone, UserContext } from '../../types/settings';

export function PracticePage() {
    const [context, setContext] = useState<UserContext>({
        profile: '',
        interests: '',
        goals: '',
        currentLevel: 'Intermediate',
    });

    const [situation, setSituation] = useState('');
    const [generatedDialogue, setGeneratedDialogue] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tone, setTone] = useState<ConversationTone>('casual');

    useEffect(() => {
        void (async () => {
            const [userContext, conversationTone] = await Promise.all([
                getUserContext(),
                getConversationTone(),
            ]);
            setContext(userContext);
            setTone(conversationTone);
        })();
    }, []);

    const handleGenerate = async () => {
        if (!situation.trim()) {
            setError('Descreva uma cena para gerar o script.');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setGeneratedDialogue(null);

        try {
            const prompt = getCustomDialoguePrompt(
                situation,
                context.profile,
                context.interests,
                context.goals,
                context.currentLevel,
                tone
            );

            const response = await chatCompletion(
                'You are an expert English script writer. Produce natural, conversational dialogue scripts for acting practice. Only use Markdown layout.',
                prompt
            );

            setGeneratedDialogue(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao gerar o script.');
        } finally {
            setIsGenerating(false);
        }
    };

    const wrapText = (doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, x, y);
        return lines.length * lineHeight;
    };

    const handleExportPDF = () => {
        if (!generatedDialogue) return;

        try {
            const doc = new jsPDF();
            const margin = 15;
            const maxWidth = 180;
            const lineHeight = 7;
            let yOffset = 20;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text('Script de Atuação', margin, yOffset);
            yOffset += 12;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);

            const paragraphs = generatedDialogue.split('\n');

            for (let i = 0; i < paragraphs.length; i++) {
                let text = paragraphs[i].trim();
                if (!text) {
                    yOffset += lineHeight;
                    continue;
                }

                if (text.startsWith('##') || text.startsWith('#')) {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(14);
                    text = text.replace(/^#+\s*/, '');
                    const height = wrapText(doc, text, margin, yOffset, maxWidth, lineHeight);
                    yOffset += height + 4;
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(12);
                } else if (text.startsWith('- ')) {
                    doc.text('•', margin, yOffset);
                    const height = wrapText(doc, text.substring(2), margin + 5, yOffset, maxWidth - 5, lineHeight);
                    yOffset += height;
                } else {
                    const boldMatch = text.match(/^\*\*(.*?)\*\*(.*)/);
                    if (boldMatch) {
                        const name = boldMatch[1];
                        const rest = boldMatch[2];

                        doc.setFont('helvetica', 'bold');
                        doc.text(name, margin, yOffset);
                        const nameWidth = doc.getTextWidth(name);

                        doc.setFont('helvetica', 'normal');
                        const height = wrapText(doc, rest, margin + nameWidth, yOffset, maxWidth - nameWidth, lineHeight);
                        yOffset += height;
                    } else {
                        const height = wrapText(doc, text.replace(/\*\*/g, ''), margin, yOffset, maxWidth, lineHeight);
                        yOffset += height;
                    }
                }

                if (yOffset > 270) {
                    doc.addPage();
                    yOffset = 20;
                }
            }

            doc.save('script-atuacao.pdf');
        } catch (e) {
            console.error(e);
            setError('Falha ao gerar PDF.');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-3 bg-[var(--coral-soft)] rounded-2xl">
                    <Clapperboard size={24} className="text-[var(--coral)]" />
                </div>
                <div>
                    <h2 className="text-2xl font-extrabold text-foreground">Scripts</h2>
                    <p className="text-muted-foreground">Pratique como um ator. Gere diálogos e atue as falas em voz alta.</p>
                </div>
            </div>

            {/* Generate Script */}
            <div className="bg-card rounded-2xl p-6 border border-border space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <FileText size={18} className="text-[var(--coral)]" />
                    <h3 className="font-bold text-lg text-foreground">Descreva a Cena</h3>
                </div>

                <div className="space-y-4">
                    <textarea
                        placeholder="ex: Entrevista técnica com um recrutador do Google para vaga de Front-End. Me pergunte sobre React e minha experiência."
                        value={situation}
                        onChange={(e) => setSituation(e.target.value)}
                        rows={4}
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none resize-none"
                    />

                    <Button
                        variant="coral"
                        onClick={handleGenerate}
                        disabled={isGenerating || !situation.trim()}
                        className="w-full justify-center"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 size={18} className="animate-spin mr-2" />
                                Gerando...
                            </>
                        ) : (
                            'Gerar Script'
                        )}
                    </Button>

                    {error && (
                        <p className="text-[var(--danger)] text-sm mt-2">{error}</p>
                    )}
                </div>
            </div>

            {/* Generated Result */}
            {generatedDialogue && (
                <div className="bg-card rounded-2xl p-6 border border-border space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between border-b border-border pb-4">
                        <h3 className="font-bold text-xl text-foreground">Seu Script</h3>
                        <Button variant="outline" onClick={handleExportPDF} className="flex gap-2">
                            <Download size={16} />
                            Exportar PDF
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Leia o script em voz alta, atuando cada fala como se fosse de verdade.
                    </p>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground bg-muted p-6 rounded-xl border border-border whitespace-pre-wrap leading-relaxed">
                        {generatedDialogue}
                    </div>
                </div>
            )}
        </div>
    );
}
