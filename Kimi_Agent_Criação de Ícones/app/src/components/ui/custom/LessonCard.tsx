import { Lock, Check, Flame } from 'lucide-react';
import type { Lesson } from '@/types';
import { cn } from '@/lib/utils';

interface LessonCardProps {
  lesson: Lesson;
  onClick?: () => void;
  variant?: 'default' | 'horizontal' | 'compact';
}

const lessonImages: Record<string, string> = {
  'travel-basics': '/images/icon-travel-basics.png',
  'hotel-checkin': '/images/icon-hotel-checkin.png',
  'navigating-nyc': '/images/icon-navigating-nyc.png',
  'lost-luggage': '/images/icon-lost-luggage.png',
  'meeting-client': '/images/icon-meeting-client.png',
  'presentation': '/images/icon-presentation.png',
};

const lessonGradients: Record<string, string> = {
  'travel-basics': 'from-sky-400 to-blue-500',
  'hotel-checkin': 'from-emerald-400 to-teal-500',
  'navigating-nyc': 'from-violet-400 to-purple-500',
  'lost-luggage': 'from-amber-400 to-orange-500',
  'meeting-client': 'from-rose-400 to-pink-500',
  'presentation': 'from-indigo-400 to-blue-500',
};

export function LessonCard({ lesson, onClick, variant = 'default' }: LessonCardProps) {
  const iconImage = lessonImages[lesson.id] || lessonImages['travel-basics'];
  const gradient = lessonGradients[lesson.id] || 'from-blue-400 to-blue-500';
  const isCompleted = lesson.progress === 100;

  if (variant === 'horizontal') {
    return (
      <div
        onClick={onClick}
        className={cn(
          'group flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-100 cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-blue-50 hover:-translate-y-0.5',
          lesson.locked && 'opacity-70 cursor-not-allowed'
        )}
      >
        {/* Icon */}
        <div className={cn(
          'w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 p-2',
          'bg-gradient-to-br',
          gradient
        )}>
          {lesson.locked ? (
            <Lock className="w-6 h-6 text-white" />
          ) : isCompleted ? (
            <Check className="w-6 h-6 text-white" />
          ) : (
            <img src={iconImage} alt={lesson.title} className="w-full h-full object-contain" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-slate-800 truncate">{lesson.title}</h3>
            {isCompleted && (
              <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs font-bold rounded-full">
                Done
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm truncate">{lesson.description}</p>
        </div>

        {/* XP */}
        <div className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 rounded-full border border-orange-100">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-bold text-orange-600">{lesson.xp} XP</span>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        onClick={onClick}
        className={cn(
          'group flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 cursor-pointer transition-all duration-300 hover:shadow-md hover:border-blue-200',
          lesson.locked && 'opacity-60 cursor-not-allowed'
        )}
      >
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 p-1.5',
          'bg-gradient-to-br',
          gradient
        )}>
          {lesson.locked ? (
            <Lock className="w-4 h-4 text-white" />
          ) : (
            <img src={iconImage} alt={lesson.title} className="w-full h-full object-contain" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-800 text-sm truncate">{lesson.title}</h4>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                style={{ width: `${lesson.progress}%` }}
              />
            </div>
            <span className="text-xs text-slate-400">{lesson.completedSteps}/{lesson.totalSteps}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-blue-100 hover:-translate-y-1',
        lesson.locked && 'opacity-70 cursor-not-allowed'
      )}
    >
      {/* Background */}
      <div className={cn('absolute inset-0 bg-gradient-to-br', gradient)} />
      
      {/* Decorative */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm p-1">
            {lesson.locked ? (
              <Lock className="w-5 h-5 text-white" />
            ) : (
              <img src={iconImage} alt={lesson.title} className="w-full h-full object-contain" />
            )}
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-lg backdrop-blur-sm">
            <Flame className="w-3 h-3 text-white" />
            <span className="text-xs font-bold text-white">{lesson.xp} XP</span>
          </div>
        </div>

        {/* Content */}
        <h3 className="text-white font-bold mb-1">{lesson.title}</h3>
        <p className="text-white/80 text-sm mb-3">{lesson.description}</p>

        {/* Progress */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${lesson.progress}%` }}
            />
          </div>
          <span className="text-white text-xs font-medium">{lesson.progress}%</span>
        </div>
      </div>
    </div>
  );
}
