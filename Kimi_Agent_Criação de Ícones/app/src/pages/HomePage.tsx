import { ChevronRight, Compass, Target, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PathCard, ProgressBar } from '@/components/ui/custom';
import { currentUser, paths } from '@/data/mockData';

interface HomePageProps {
  onNavigate: (page: string, params?: any) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const travelPath = paths.find(p => p.id === 'travel-path');
  const workPath = paths.find(p => p.id === 'work-path');

  return (
    <div className="space-y-6 pb-20">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Hi {currentUser.name}!
          </h1>
          <p className="text-slate-500">Ready for a new challenge?</p>
        </div>
        <div className="w-12 h-12 bg-gradient-to-br from-amber-200 to-amber-300 rounded-full flex items-center justify-center">
          <span className="text-2xl">👋</span>
        </div>
      </div>

      {/* Progress Bar */}
      <ProgressBar 
        current={currentUser.xp}
        max={currentUser.maxXp}
        level={currentUser.level}
        streak={currentUser.streak}
      />

      {/* Continue Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Continue</h2>
          <button 
            onClick={() => onNavigate('discover')}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            See all
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid gap-4">
          {travelPath && (
            <PathCard 
              path={travelPath} 
              onClick={() => onNavigate('path', { pathId: travelPath.id })}
            />
          )}
          {workPath && (
            <PathCard 
              path={workPath} 
              onClick={() => onNavigate('path', { pathId: workPath.id })}
            />
          )}
        </div>
      </section>

      {/* Explore Scenarios */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Explore Scenarios</h2>
          <Sparkles className="w-5 h-5 text-yellow-500" />
        </div>
        
        <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 text-white relative overflow-hidden">
          {/* Decorative */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl">🎭</span>
              <div className="px-2 py-1 bg-white/20 rounded-lg backdrop-blur-sm">
                <span className="text-xs font-bold">60-130 XP</span>
              </div>
            </div>
            
            <h3 className="text-xl font-bold mb-1">Role Play</h3>
            <p className="text-white/80 text-sm mb-4">Act like it's real life.</p>
            
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                size="sm"
                className="bg-white text-purple-600 hover:bg-white/90 font-semibold"
                onClick={() => onNavigate('practice')}
              >
                <Target className="w-4 h-4 mr-2" />
                Random Scenario
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="border-white/30 text-white hover:bg-white/10"
              >
                <Compass className="w-4 h-4 mr-2" />
                Custom
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Quick Start</h2>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => onNavigate('practice')}
            className="p-4 bg-blue-50 rounded-2xl border border-blue-100 hover:bg-blue-100 transition-colors text-left"
          >
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center mb-3">
              <Target className="w-5 h-5 text-white" />
            </div>
            <h4 className="font-bold text-slate-800">Practice</h4>
            <p className="text-sm text-slate-500">Daily exercises</p>
          </button>
          
          <button 
            onClick={() => onNavigate('discover')}
            className="p-4 bg-purple-50 rounded-2xl border border-purple-100 hover:bg-purple-100 transition-colors text-left"
          >
            <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center mb-3">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <h4 className="font-bold text-slate-800">Discover</h4>
            <p className="text-sm text-slate-500">New lessons</p>
          </button>
        </div>
      </section>
    </div>
  );
}
