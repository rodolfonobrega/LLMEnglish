import { TrendingUp, Award } from 'lucide-react';
import { currentUser } from '@/data/mockData';
import { cn } from '@/lib/utils';

const weeklyProgress = [
  { day: 'Mon', minutes: 25, completed: true },
  { day: 'Tue', minutes: 45, completed: true },
  { day: 'Wed', minutes: 30, completed: true },
  { day: 'Thu', minutes: 60, completed: true },
  { day: 'Fri', minutes: 20, completed: true },
  { day: 'Sat', minutes: 40, completed: true },
  { day: 'Sun', minutes: 0, completed: false },
];

const achievements = [
  { id: '1', title: 'First Steps', description: 'Complete your first lesson', icon: '🎯', unlocked: true },
  { id: '2', title: 'Week Warrior', description: '7 day streak', icon: '🔥', unlocked: true },
  { id: '3', title: 'Word Master', description: 'Learn 100 words', icon: '📚', unlocked: true },
  { id: '4', title: 'Perfect Score', description: 'Get 100% on a lesson', icon: '⭐', unlocked: false },
  { id: '5', title: 'Month Master', description: '30 day streak', icon: '🏆', unlocked: false },
];

const skills = [
  { name: 'Speaking', level: 75, color: 'bg-blue-500' },
  { name: 'Listening', level: 82, color: 'bg-green-500' },
  { name: 'Vocabulary', level: 68, color: 'bg-purple-500' },
  { name: 'Grammar', level: 55, color: 'bg-orange-500' },
];

export function ProgressPage() {
  const totalMinutes = weeklyProgress.reduce((sum, day) => sum + day.minutes, 0);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Your Progress</h1>
        <p className="text-slate-500">Track your learning journey</p>
      </div>

      {/* Weekly Stats */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-slate-800">This Week</h2>
            <p className="text-sm text-slate-500">{totalMinutes} minutes studied</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm font-bold text-green-600">+12%</span>
          </div>
        </div>

        {/* Weekly Chart */}
        <div className="flex items-end justify-between gap-2 h-32">
          {weeklyProgress.map((day) => (
            <div key={day.day} className="flex flex-col items-center gap-2 flex-1">
              <div className="w-full relative">
                <div 
                  className={cn(
                    'w-full rounded-t-lg transition-all duration-500',
                    day.completed ? 'bg-blue-500' : 'bg-slate-200'
                  )}
                  style={{ height: `${(day.minutes / 60) * 80 + 20}px` }}
                />
                {day.completed && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                )}
              </div>
              <span className={cn(
                'text-xs font-medium',
                day.completed ? 'text-blue-600' : 'text-slate-400'
              )}>
                {day.day}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Skills */}
      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Skills</h2>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 space-y-4">
          {skills.map((skill) => (
            <div key={skill.name}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-slate-700">{skill.name}</span>
                <span className="text-sm font-bold text-slate-800">{skill.level}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={cn('h-full rounded-full transition-all duration-500', skill.color)}
                  style={{ width: `${skill.level}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Achievements */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Achievements</h2>
          <span className="text-sm text-slate-500">{achievements.filter(a => a.unlocked).length}/{achievements.length}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {achievements.map((achievement) => (
            <div 
              key={achievement.id}
              className={cn(
                'p-4 rounded-2xl border transition-all',
                achievement.unlocked 
                  ? 'bg-white border-slate-100' 
                  : 'bg-slate-50 border-slate-200 opacity-60'
              )}
            >
              <div className="text-3xl mb-2">{achievement.icon}</div>
              <h3 className={cn(
                'font-bold text-sm',
                achievement.unlocked ? 'text-slate-800' : 'text-slate-400'
              )}>
                {achievement.title}
              </h3>
              <p className="text-xs text-slate-500">{achievement.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Level Progress */}
      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Level Progress</h2>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-blue-100 text-sm">Current Level</p>
              <p className="text-3xl font-bold">Level {currentUser.level}</p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Award className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <div className="mb-2">
            <div className="flex items-center justify-between text-sm mb-1">
              <span>{currentUser.xp} XP</span>
              <span>{currentUser.maxXp} XP</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${(currentUser.xp / currentUser.maxXp) * 100}%` }}
              />
            </div>
          </div>
          
          <p className="text-blue-100 text-sm">
            {currentUser.maxXp - currentUser.xp} XP until Level {currentUser.level + 1}
          </p>
        </div>
      </section>
    </div>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
