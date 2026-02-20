import type { Scenario } from '@/types';
import { cn } from '@/lib/utils';

interface ScenarioSceneProps {
  scenario: Scenario;
  className?: string;
}

export function ScenarioScene({ scenario, className }: ScenarioSceneProps) {
  return (
    <div className={cn(
      'relative rounded-3xl overflow-hidden bg-gradient-to-b from-sky-100 to-blue-50',
      className
    )}>
      {/* Background Scene */}
      <div className="absolute inset-0">
        {/* Hotel Lobby Background Image */}
        <img 
          src="/images/hotel-lobby.jpg" 
          alt="Hotel Lobby" 
          className="w-full h-full object-cover"
        />
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-white/30" />
      </div>

      {/* Content */}
      <div className="relative p-6 min-h-[280px] flex flex-col justify-end">
        {/* Character */}
        <div className="absolute top-6 left-6">
          <div className="relative">
            {/* Character Avatar */}
            <div className="w-20 h-20 rounded-full border-4 border-white shadow-xl flex items-center justify-center overflow-hidden bg-white">
              <img 
                src="/images/character-receptionist.png" 
                alt={scenario.character.name}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Status Indicator */}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
          </div>
        </div>

        {/* Speech Bubble */}
        <div className="ml-24 mb-4">
          <div className="relative bg-white rounded-2xl rounded-tl-sm p-4 shadow-lg max-w-md">
            {/* Triangle */}
            <div className="absolute -left-2 top-0 w-4 h-4 bg-white transform rotate-45" />
            
            {/* Character Name */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {scenario.character.role}
              </span>
            </div>
            
            {/* Dialogue */}
            <p className="text-slate-800 text-lg leading-relaxed font-medium">
              {scenario.dialogue}
            </p>
          </div>
        </div>

        {/* Scene Decorations */}
        <div className="absolute bottom-4 right-4 flex items-end gap-2 opacity-60">
          <div className="w-8 h-16 bg-amber-200/50 rounded-lg" />
          <div className="w-6 h-12 bg-amber-300/50 rounded-lg" />
          <div className="w-10 h-20 bg-amber-200/50 rounded-lg" />
        </div>

        {/* Plant */}
        <div className="absolute bottom-0 left-1/4">
          <div className="text-6xl opacity-70">🪴</div>
        </div>
      </div>
    </div>
  );
}
