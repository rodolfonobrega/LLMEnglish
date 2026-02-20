import { User, Bell, Shield, HelpCircle, LogOut, ChevronRight, Edit3, Globe, Moon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { currentUser } from '@/data/mockData';
import { cn } from '@/lib/utils';

const menuItems = [
  { id: 'edit', label: 'Edit Profile', icon: Edit3, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'notifications', label: 'Notifications', icon: Bell, color: 'text-purple-600', bg: 'bg-purple-50' },
  { id: 'language', label: 'Language', icon: Globe, color: 'text-green-600', bg: 'bg-green-50', value: 'English' },
  { id: 'appearance', label: 'Appearance', icon: Moon, color: 'text-indigo-600', bg: 'bg-indigo-50', value: 'Light' },
  { id: 'privacy', label: 'Privacy & Security', icon: Shield, color: 'text-red-600', bg: 'bg-red-50' },
  { id: 'help', label: 'Help & Support', icon: HelpCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
];

export function ProfilePage() {
  return (
    <div className="space-y-6 pb-20">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="w-20 h-20 border-4 border-blue-100">
              <AvatarImage src={currentUser.avatar} />
              <AvatarFallback className="bg-blue-100 text-blue-600 text-2xl">
                <User className="w-8 h-8" />
              </AvatarFallback>
            </Avatar>
            <button className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-colors">
              <Edit3 className="w-4 h-4 text-white" />
            </button>
          </div>
          
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800">{currentUser.name}</h1>
            <p className="text-slate-500">Level {currentUser.level} Learner</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="px-2 py-1 bg-blue-50 rounded-lg">
                <span className="text-xs font-bold text-blue-600">{currentUser.xp} XP</span>
              </div>
              <div className="px-2 py-1 bg-orange-50 rounded-lg">
                <span className="text-xs font-bold text-orange-600">{currentUser.streak} 🔥</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-2xl font-bold text-slate-800">28</p>
          <p className="text-xs text-slate-500">Lessons</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-2xl font-bold text-slate-800">342</p>
          <p className="text-xs text-slate-500">Words</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-2xl font-bold text-slate-800">48h</p>
          <p className="text-xs text-slate-500">Practice</p>
        </div>
      </div>

      {/* Settings Menu */}
      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Settings</h2>
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={cn(
                  'w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors',
                  index !== menuItems.length - 1 && 'border-b border-slate-100'
                )}
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', item.bg)}>
                  <Icon className={cn('w-5 h-5', item.color)} />
                </div>
                <span className="flex-1 text-left font-medium text-slate-700">{item.label}</span>
                {item.value && (
                  <span className="text-sm text-slate-400">{item.value}</span>
                )}
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>
            );
          })}
        </div>
      </section>

      {/* Logout */}
      <button className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 rounded-2xl text-red-600 font-medium hover:bg-red-100 transition-colors">
        <LogOut className="w-5 h-5" />
        Log Out
      </button>

      {/* App Info */}
      <div className="text-center">
        <p className="text-sm text-slate-400">FluentCards v1.0.0</p>
        <p className="text-xs text-slate-300 mt-1">Made with ❤️ for language learners</p>
      </div>
    </div>
  );
}
