import { ChevronLeft, Star, Flame, Lock, Play } from 'lucide-react';
import { paths, suggestedWords } from '@/data/mockData';
import { XPBadge, WordChip } from '@/components/ui/custom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DiscoverPageProps {
  onNavigate: (page: string, params?: any) => void;
}

const lessonImages: Record<string, string> = {
  'travel-basics': '/images/icon-travel-basics.png',
  'hotel-checkin': '/images/icon-hotel-checkin.png',
  'navigating-nyc': '/images/icon-navigating-nyc.png',
  'lost-luggage': '/images/icon-lost-luggage.png',
};

const lessonColors: Record<string, string> = {
  'travel-basics': 'from-sky-400 to-blue-500',
  'hotel-checkin': 'from-emerald-400 to-teal-500',
  'navigating-nyc': 'from-violet-400 to-purple-500',
  'lost-luggage': 'from-amber-400 to-orange-500',
};

export function DiscoverPage({ onNavigate }: DiscoverPageProps) {
  const travelPath = paths.find(p => p.id === 'travel-path');
  
  if (!travelPath) return null;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => onNavigate('home')}
          className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{travelPath.title}</h1>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>{travelPath.nextLesson}</span>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              <span>5/12</span>
            </div>
          </div>
        </div>
        <div className="ml-auto">
          <XPBadge amount={80} variant="possible" />
        </div>
      </div>

      {/* Featured Lesson Card */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-sky-400 to-blue-500 p-6">
        {/* Decorative */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="px-3 py-1 bg-white/20 rounded-full backdrop-blur-sm">
              <span className="text-xs font-bold text-white">At the Airport</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-yellow-400/30 rounded-full backdrop-blur-sm">
              <Star className="w-3 h-3 text-yellow-300 fill-yellow-300" />
              <span className="text-xs font-bold text-white">5/12</span>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">At the Airport</h2>
          
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-lg backdrop-blur-sm">
              <Flame className="w-4 h-4 text-white" />
              <span className="text-sm font-bold text-white">80 XP</span>
            </div>
            <span className="text-white/70 text-sm">+23 Streak Bonus</span>
          </div>

          {/* Scene Preview */}
          <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm mb-4">
            <div className="flex items-center gap-4">
              <img 
                src="/images/airport-scene.jpg" 
                alt="Airport" 
                className="w-20 h-20 rounded-xl object-cover"
              />
              <div className="text-white">
                <p className="font-medium">Learn airport vocabulary</p>
                <p className="text-sm text-white/70">Check-in, security, boarding</p>
              </div>
            </div>
          </div>

          <Button 
            className="w-full bg-white text-blue-600 hover:bg-white/90 font-bold py-6"
            onClick={() => onNavigate('practice')}
          >
            <Play className="w-5 h-5 mr-2 fill-current" />
            Start Challenge
            <span className="ml-2 text-blue-400">+80 XP</span>
          </Button>
        </div>
      </div>

      {/* Lessons List */}
      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Lessons</h2>
        <div className="space-y-3">
          {travelPath.lessons.map((lesson) => {
            const iconImage = lessonImages[lesson.id] || lessonImages['travel-basics'];
            const gradient = lessonColors[lesson.id] || 'from-blue-400 to-blue-500';
            const isCompleted = lesson.progress === 100;
            const isLocked = lesson.locked;
            
            return (
              <div
                key={lesson.id}
                onClick={() => !isLocked && onNavigate('practice')}
                className={cn(
                  'flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 transition-all',
                  !isLocked && 'hover:shadow-lg hover:shadow-blue-50 cursor-pointer hover:-translate-y-0.5',
                  isLocked && 'opacity-60 cursor-not-allowed'
                )}
              >
                {/* Icon/Progress */}
                <div className={cn(
                  'w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 p-2',
                  'bg-gradient-to-br',
                  gradient
                )}>
                  {isLocked ? (
                    <Lock className="w-6 h-6 text-white" />
                  ) : isCompleted ? (
                    <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <img src={iconImage} alt={lesson.title} className="w-full h-full object-contain" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800">{lesson.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[100px]">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                        style={{ width: `${lesson.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400">{lesson.completedSteps}/{lesson.totalSteps}</span>
                  </div>
                </div>

                {/* XP */}
                <div className="flex items-center gap-1 px-2 py-1 bg-orange-50 rounded-lg">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-bold text-orange-600">{lesson.xp}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Suggested Words */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Suggested Words</h2>
          <ChevronLeft className="w-5 h-5 text-slate-400 rotate-180" />
        </div>
        <div className="flex flex-wrap gap-2">
          {suggestedWords.map((item) => (
            <WordChip 
              key={item.word} 
              word={item.word}
              isHighlighted={item.word === 'boarding pass'}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
