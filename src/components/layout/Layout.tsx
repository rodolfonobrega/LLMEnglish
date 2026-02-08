import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Navigation } from './Navigation';

export function Layout() {
  return (
    <div className="min-h-dvh bg-parchment text-ink transition-colors duration-200">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
        <Outlet />
      </main>
      <Navigation />
    </div>
  );
}
