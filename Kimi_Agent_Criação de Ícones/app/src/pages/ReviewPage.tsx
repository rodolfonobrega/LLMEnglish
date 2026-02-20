import { BookOpen, RotateCcw, Clock, CheckCircle, Star, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReviewPageProps {
  onNavigate: (page: string, params?: any) => void;
}

const reviewItems = [
  { id: '1', title: 'Travel Vocabulary', lastReviewed: '2 days ago', mastery: 85, totalWords: 24 },
  { id: '2', title: 'Hotel Phrases', lastReviewed: '5 days ago', mastery: 72, totalWords: 18 },
  { id: '3', title: 'Airport Terms', lastReviewed: '1 week ago', mastery: 60, totalWords: 32 },
  { id: '4', title: 'Restaurant Basics', lastReviewed: '2 weeks ago', mastery: 45, totalWords: 28 },
];

const stats = [
  { label: 'Words Learned', value: 342, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Lessons Completed', value: 28, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
  { label: 'Day Streak', value: 23, icon: Star, color: 'text-orange-600', bg: 'bg-orange-50' },
  { label: 'Hours Practiced', value: 48, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
];

export function ReviewPage({ onNavigate }: ReviewPageProps) {
  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Review</h1>
        <p className="text-slate-500">Practice what you've learned</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-2xl p-4 border border-slate-100">
              <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Review */}
      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Quick Review</h2>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold mb-1">Daily Review</h3>
              <p className="text-blue-100 text-sm">15 words waiting for review</p>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <RotateCcw className="w-7 h-7 text-white" />
            </div>
          </div>
          <button 
            onClick={() => onNavigate('practice')}
            className="w-full py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-white/90 transition-colors"
          >
            Start Review Session
          </button>
        </div>
      </section>

      {/* Review List */}
      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Your Decks</h2>
        <div className="space-y-3">
          {reviewItems.map((item) => (
            <div 
              key={item.id}
              onClick={() => onNavigate('practice')}
              className="bg-white rounded-2xl p-4 border border-slate-100 hover:shadow-lg hover:shadow-blue-50 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    item.mastery >= 80 ? 'bg-green-100' :
                    item.mastery >= 60 ? 'bg-yellow-100' : 'bg-red-100'
                  )}>
                    <BookOpen className={cn(
                      'w-6 h-6',
                      item.mastery >= 80 ? 'text-green-600' :
                      item.mastery >= 60 ? 'text-yellow-600' : 'text-red-600'
                    )} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{item.title}</h3>
                    <p className="text-sm text-slate-500">{item.totalWords} words • {item.lastReviewed}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={cn(
                      'text-sm font-bold',
                      item.mastery >= 80 ? 'text-green-600' :
                      item.mastery >= 60 ? 'text-yellow-600' : 'text-red-600'
                    )}>
                      {item.mastery}%
                    </p>
                    <p className="text-xs text-slate-400">mastery</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    'h-full rounded-full transition-all',
                    item.mastery >= 80 ? 'bg-green-500' :
                    item.mastery >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  )}
                  style={{ width: `${item.mastery}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
