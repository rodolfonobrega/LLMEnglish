import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Navigation } from './Navigation';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Desktop Only */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-6 pb-24 w-full">
          <Outlet />
        </main>
      </div>

      {/* Navigation - Mobile Only */}
      <div className="lg:hidden">
        <Navigation />
      </div>
    </div>
  );
}
