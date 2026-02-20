import type { NavigationTab } from '@/types';
import { Home, Compass, Target, BookOpen, BarChart3, User } from 'lucide-react';

interface SidebarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
}

const sidebarItems: { id: NavigationTab; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'practice', label: 'Practice', icon: Target },
  { id: 'review', label: 'Review', icon: BookOpen },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: User },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-slate-100 h-screen sticky top-0 hidden lg:flex flex-col">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <img 
            src="/images/logo-fluentcards.png" 
            alt="FluentCards" 
            className="w-10 h-10 object-contain"
          />
          <div>
            <h1 className="font-bold text-slate-800">FluentCards</h1>
            <span className="text-xs font-semibold text-blue-600">LEVEL 5</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4">
        <ul className="space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🔥</span>
            <span className="font-bold">23 Day Streak!</span>
          </div>
          <p className="text-sm text-blue-100">Keep it up! You're doing great!</p>
        </div>
      </div>
    </aside>
  );
}
