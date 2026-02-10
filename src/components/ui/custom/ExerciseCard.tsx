import { ChevronRight } from 'lucide-react';

interface ExerciseCardProps {
  title: string;
  description: string;
  emoji: string;
  gradient: string;
  progress?: number;
  onClick?: () => void;
}

export function ExerciseCard({ title, description, emoji, gradient, progress, onClick }: ExerciseCardProps) {
  return (
    <div
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
    >
      {/* Background Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <span className="text-2xl">{emoji}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/20 text-white backdrop-blur-sm">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Content */}
        <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
        <p className="text-white/80 text-sm">{description}</p>

        {/* Progress */}
        {progress !== undefined && (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-white text-xs font-medium">{progress}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
