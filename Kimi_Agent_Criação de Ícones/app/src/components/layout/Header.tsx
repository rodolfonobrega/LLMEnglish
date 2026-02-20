import { Flame, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { currentUser } from '@/data/mockData';
import type { NavigationTab } from '@/types';

interface HeaderProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  variant?: 'default' | 'minimal';
}

const navItems: { id: NavigationTab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'discover', label: 'Discover', icon: '✨' },
  { id: 'practice', label: 'Practice', icon: '🎯' },
  { id: 'review', label: 'Review', icon: '📚' },
  { id: 'progress', label: 'Progress', icon: '📊' },
];

export function Header({ activeTab, onTabChange, variant = 'default' }: HeaderProps) {
  if (variant === 'minimal') {
    return (
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100">
        <div className="flex items-center gap-3">
          <img 
            src="/images/logo-fluentcards.png" 
            alt="FluentCards" 
            className="w-10 h-10 object-contain"
          />
          <div>
            <h1 className="font-bold text-slate-800 text-lg">FluentCards</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-600">LEVEL {currentUser.level}</span>
              <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                  style={{ width: `${(currentUser.xp / currentUser.maxXp) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-full border border-orange-100">
            <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
            <span className="text-sm font-bold text-orange-600">{currentUser.streak}</span>
          </div>
          <Avatar className="w-10 h-10 border-2 border-blue-100">
            <AvatarImage src={currentUser.avatar} />
            <AvatarFallback className="bg-blue-100 text-blue-600">
              <User className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img 
            src="/images/logo-fluentcards.png" 
            alt="FluentCards" 
            className="w-10 h-10 object-contain"
          />
          <div>
            <h1 className="font-bold text-slate-800 text-lg leading-tight">FluentCards</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-600">LEVEL {currentUser.level}</span>
              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                  style={{ width: `${(currentUser.xp / currentUser.maxXp) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User Stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-full border border-orange-100">
            <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
            <span className="text-sm font-bold text-orange-600">{currentUser.streak}</span>
          </div>
          <Avatar className="w-10 h-10 border-2 border-blue-100 cursor-pointer hover:border-blue-300 transition-colors">
            <AvatarImage src={currentUser.avatar} />
            <AvatarFallback className="bg-blue-100 text-blue-600">
              <User className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden flex items-center justify-around px-2 py-2 border-t border-slate-100">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${
              activeTab === item.id
                ? 'text-blue-600'
                : 'text-slate-400'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </header>
  );
}
