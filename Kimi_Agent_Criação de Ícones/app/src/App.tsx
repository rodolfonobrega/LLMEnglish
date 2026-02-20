import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { 
  HomePage, 
  DiscoverPage, 
  PracticePage, 
  ReviewPage, 
  ProgressPage, 
  ProfilePage 
} from '@/pages';
import type { NavigationTab } from '@/types';
import './App.css';

type PageType = 'home' | 'discover' | 'practice' | 'review' | 'progress' | 'profile' | 'path';

interface NavigationState {
  page: PageType;
  params?: any;
}

function App() {
  const [navigation, setNavigation] = useState<NavigationState>({ page: 'home' });

  const handleNavigate = (page: string, params?: any) => {
    setNavigation({ page: page as PageType, params });
  };

  const handleTabChange = (tab: NavigationTab) => {
    setNavigation({ page: tab });
  };

  const renderPage = () => {
    switch (navigation.page) {
      case 'home':
        return <HomePage onNavigate={handleNavigate} />;
      case 'discover':
      case 'path':
        return <DiscoverPage onNavigate={handleNavigate} />;
      case 'practice':
        return <PracticePage onNavigate={handleNavigate} />;
      case 'review':
        return <ReviewPage onNavigate={handleNavigate} />;
      case 'progress':
        return <ProgressPage />;
      case 'profile':
        return <ProfilePage />;
      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        {/* Sidebar - Desktop Only */}
        <Sidebar 
          activeTab={navigation.page as NavigationTab} 
          onTabChange={handleTabChange} 
        />

        {/* Main Content */}
        <div className="flex-1 min-h-screen">
          {/* Header */}
          <Header 
            activeTab={navigation.page as NavigationTab}
            onTabChange={handleTabChange}
            variant={navigation.page === 'practice' ? 'minimal' : 'default'}
          />

          {/* Page Content */}
          <main className="p-4 md:p-6 max-w-4xl mx-auto">
            {renderPage()}
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
