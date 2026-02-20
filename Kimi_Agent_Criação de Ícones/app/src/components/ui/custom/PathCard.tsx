import { ChevronRight, Star } from 'lucide-react';
import type { Path } from '@/types';

interface PathCardProps {
  path: Path;
  onClick?: () => void;
}

const categoryImages: Record<string, string> = {
  travel: '/images/icon-travel-path.png',
  work: '/images/icon-work-path.png',
};

const categoryColors: Record<string, { bg: string; badge: string }> = {
  travel: {
    bg: 'from-sky-400 to-blue-500',
    badge: 'bg-white/20 text-white',
  },
  work: {
    bg: 'from-violet-400 to-purple-500',
    badge: 'bg-white/20 text-white',
  },
};

export function PathCard({ path, onClick }: PathCardProps) {
  const iconImage = categoryImages[path.category] || categoryImages.travel;
  const colors = categoryColors[path.category] || categoryColors.travel;

  return (
    <div
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-blue-100 hover:-translate-y-1"
    >
      {/* Background Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg}`} />
      
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm p-1">
            <img src={iconImage} alt={path.title} className="w-full h-full object-contain" />
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${colors.badge} backdrop-blur-sm`}>
            <Star className="w-3 h-3 fill-current" />
            <span className="text-xs font-bold">{path.xpRange} XP</span>
          </div>
        </div>

        {/* Content */}
        <h3 className="text-white font-bold text-lg mb-1">{path.title}</h3>
        <p className="text-white/80 text-sm mb-3">Next: {path.nextLesson}</p>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${path.progress}%` }}
            />
          </div>
          <span className="text-white text-xs font-medium">{path.progress}%</span>
        </div>

        {/* Arrow */}
        <div className="absolute bottom-5 right-5 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
          <ChevronRight className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  );
}
