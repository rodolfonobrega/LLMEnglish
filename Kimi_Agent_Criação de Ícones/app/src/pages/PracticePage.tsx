import { useState } from 'react';
import { ChevronLeft, Volume2, Lightbulb, Turtle, Zap, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  MicrophoneButton, 
  WordChipGroup, 
  FeedbackPanel, 
  ScenarioScene,
  XPBadge 
} from '@/components/ui/custom';
import { currentScenario, feedbackItems } from '@/data/mockData';
import { cn } from '@/lib/utils';

interface PracticePageProps {
  onNavigate: (page: string, params?: any) => void;
}

export function PracticePage({ onNavigate }: PracticePageProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [usedWords, setUsedWords] = useState<string[]>([]);
  const [showHint, setShowHint] = useState(false);

  const handleRecord = () => {
    setIsRecording(!isRecording);
    if (isRecording) {
      // Simulating speech recognition completion
      setTimeout(() => {
        setShowFeedback(true);
        setUsedWords(['check-in']);
      }, 500);
    }
  };

  const handleWordClick = (word: string) => {
    if (!usedWords.includes(word)) {
      setUsedWords([...usedWords, word]);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Breadcrumb Header */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => onNavigate('discover')}
          className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold text-slate-800">Travel</span>
          <ArrowRight className="w-4 h-4 text-slate-400" />
          <span className="text-slate-600">Hotel</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="px-3 py-1.5 bg-green-50 rounded-full border border-green-100">
            <span className="text-xs font-bold text-green-600">✓ Normal</span>
          </div>
          <XPBadge amount={120} variant="possible" size="sm" />
        </div>
      </div>

      {/* Scenario Scene */}
      <ScenarioScene scenario={currentScenario} />

      {/* Your Turn Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-blue-600 text-center mb-6">Your Turn</h2>
        
        {/* Microphone Area */}
        <div className="relative bg-gradient-to-b from-blue-50 to-white rounded-2xl p-8 mb-6">
          {/* Wave Animation */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center opacity-30">
            <div className="flex items-center gap-1">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-blue-400 rounded-full animate-pulse"
                  style={{
                    height: `${Math.random() * 40 + 10}px`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: '0.8s'
                  }}
                />
              ))}
            </div>
          </div>

          <div className="relative text-center">
            <p className="text-blue-600 font-bold text-xl mb-6">Hold & Speak!</p>
            
            <div className="flex items-center justify-center gap-8">
              {/* Left Words */}
              <div className="flex flex-col gap-2">
                {currentScenario.suggestedWords.slice(0, 2).map((word) => (
                  <WordChipGroup
                    key={word}
                    words={[word]}
                    highlightedWords={usedWords}
                    onWordClick={handleWordClick}
                  />
                ))}
              </div>

              {/* Microphone */}
              <MicrophoneButton 
                isRecording={isRecording}
                onClick={handleRecord}
                size="lg"
              />

              {/* Right Words */}
              <div className="flex flex-col gap-2">
                {currentScenario.suggestedWords.slice(2).map((word) => (
                  <WordChipGroup
                    key={word}
                    words={[word]}
                    highlightedWords={usedWords}
                    onWordClick={handleWordClick}
                  />
                ))}
              </div>
            </div>

            <p className="text-slate-500 text-sm mt-8">
              Use these words for bonus XP!
            </p>
            {usedWords.length > 0 && (
              <div className="mt-2">
                <XPBadge amount={5} variant="bonus" size="sm" />
              </div>
            )}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
            <Turtle className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">Slower</span>
          </button>
          
          <button 
            onClick={() => setShowHint(!showHint)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl transition-colors",
              showHint ? "bg-yellow-100" : "bg-slate-100 hover:bg-slate-200"
            )}
          >
            <Lightbulb className={cn("w-4 h-4", showHint ? "text-yellow-600" : "text-slate-600")} />
            <span className={cn("text-sm font-medium", showHint ? "text-yellow-700" : "text-slate-700")}>Hint</span>
            <span className="text-xs text-slate-400">-5 XP</span>
          </button>
          
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
            <Volume2 className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">Replay</span>
          </button>
          
          <button className="flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-xl border border-orange-100">
            <Zap className="w-4 h-4 text-orange-500 fill-orange-500" />
            <span className="text-sm font-bold text-orange-600">Combo</span>
          </button>
        </div>

        {/* Hints */}
        {showHint && (
          <div className="mt-4 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
            <p className="text-sm text-yellow-800 font-medium mb-2">Hints:</p>
            <ul className="space-y-1">
              {currentScenario.hints.map((hint, i) => (
                <li key={i} className="text-sm text-yellow-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                  {hint}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Feedback Panel */}
      {showFeedback && (
        <FeedbackPanel 
          items={feedbackItems}
          title="Feedback & Tips"
          defaultExpanded={true}
        />
      )}

      {/* Next Button */}
      {showFeedback && (
        <Button 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 rounded-2xl"
          onClick={() => onNavigate('discover')}
        >
          <Check className="w-5 h-5 mr-2" />
          Continue
          <span className="ml-2 text-blue-200">+15 XP</span>
        </Button>
      )}
    </div>
  );
}
