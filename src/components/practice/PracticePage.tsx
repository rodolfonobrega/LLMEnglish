import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { Loader2, FileText, Download, User as UserIcon, BookOpen } from 'lucide-react';
import { Button } from '../ui/Button';
import { chatCompletion } from '../../services/openai';
import { getUserContext, saveUserContext, type UserContext } from '../../services/storage';
import { getCustomDialoguePrompt } from '../../utils/prompts';

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

    useEffect(() => {
        setContext(getUserContext());
    }, []);

    const handleContextChange = (field: keyof UserContext, value: string) => {
        const newContext = { ...context, [field]: value };
        setContext(newContext);
        saveUserContext(newContext); // Auto-save
    };

    const handleGenerate = async () => {
        if (!situation.trim()) {
            setError('Please provide a situation.');
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
                context.currentLevel
            );

            const response = await chatCompletion(
                'You are an expert English material creator. Produce natural, conversational dialogue without json formatting. Only use Markdown layout.',
                prompt
            );

            setGeneratedDialogue(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate dialogue.');
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

            // Add simple title
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text('Personalized Practice Dialogue', margin, yOffset);
            yOffset += 12;

            // Reset to normal font for parsing
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);

            const paragraphs = generatedDialogue.split('\n');

            for (let i = 0; i < paragraphs.length; i++) {
                let text = paragraphs[i].trim();
                if (!text) {
                    yOffset += lineHeight; // Empty line
                    continue;
                }

                // Extremely hacky markdown to jsPDF translation for basic **bold** support
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
                    // check for bold names like **Interviewer:** Hello
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

            doc.save('practice-dialogue.pdf');
        } catch (e) {
            console.error(e);
            setError('Failed to generate PDF. Make sure your browser allows downloads.');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-3 bg-[var(--coral-soft)] rounded-2xl">
                    <FileText size={24} className="text-[var(--coral)]" />
                </div>
                <div>
                    <h2 className="text-2xl font-extrabold text-foreground">Practice Materials</h2>
                    <p className="text-muted-foreground">Generate personalized dialogues and export to PDF.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* User Context Form */}
                <div className="bg-card rounded-2xl p-6 border border-border space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <UserIcon size={18} className="text-[var(--primary)]" />
                        <h3 className="font-bold text-lg text-foreground">My Profile Context</h3>
                    </div>
                    <p className="text-sm text-muted-foreground pb-2">
                        This context is saved automatically and used to personalize your generated materials.
                    </p>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Current Level</label>
                            <select
                                value={context.currentLevel}
                                onChange={(e) => handleContextChange('currentLevel', e.target.value)}
                                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none"
                            >
                                <option value="Beginner">Beginner</option>
                                <option value="Intermediate">Intermediate</option>
                                <option value="Advanced">Advanced</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Profile / Background</label>
                            <input
                                type="text"
                                placeholder="e.g. Software Engineer looking for jobs in Canada"
                                value={context.profile}
                                onChange={(e) => handleContextChange('profile', e.target.value)}
                                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Interests</label>
                            <input
                                type="text"
                                placeholder="e.g. Technology, Gaming, Cooking, Travel"
                                value={context.interests}
                                onChange={(e) => handleContextChange('interests', e.target.value)}
                                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Learning Goals</label>
                            <input
                                type="text"
                                placeholder="e.g. Speak more fluidly in meetings, pass interviews"
                                value={context.goals}
                                onChange={(e) => handleContextChange('goals', e.target.value)}
                                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Generate Dialogue */}
                <div className="bg-card rounded-2xl p-6 border border-border space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <BookOpen size={18} className="text-[var(--leaf)]" />
                        <h3 className="font-bold text-lg text-foreground">Situation</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Describe a scenario</label>
                            <textarea
                                placeholder="e.g. Technical interview with a recruiter at Google for a Front-End position. Ask me about React and my past experience."
                                value={situation}
                                onChange={(e) => setSituation(e.target.value)}
                                rows={4}
                                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none resize-none"
                            />
                        </div>

                        <Button
                            variant="coral"
                            onClick={handleGenerate}
                            disabled={isGenerating || !situation.trim()}
                            className="w-full justify-center"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 size={18} className="animate-spin mr-2" />
                                    Generating...
                                </>
                            ) : (
                                'Generate Custom Dialogue'
                            )}
                        </Button>

                        {error && (
                            <p className="text-[var(--danger)] text-sm mt-2">{error}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Generated Result */}
            {generatedDialogue && (
                <div className="bg-card rounded-2xl p-6 border border-border space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between border-b border-border pb-4">
                        <h3 className="font-bold text-xl text-foreground">Generated Material</h3>
                        <Button variant="outline" onClick={handleExportPDF} className="flex gap-2">
                            <Download size={16} />
                            Export PDF
                        </Button>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground bg-muted p-6 rounded-xl border border-border whitespace-pre-wrap leading-relaxed">
                        {generatedDialogue}
                    </div>
                </div>
            )}
        </div>
    );
}
