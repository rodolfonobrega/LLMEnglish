import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RuntimeConfigProvider } from './contexts/RuntimeConfigContext';
import { Layout } from './components/layout/Layout';
import { LoginPage } from './components/auth/LoginPage';
import { MigrationPage } from './components/auth/MigrationPage';
import { AppErrorFallback } from './components/errors/AppErrorFallback';
import { ErrorFallback } from './components/errors/ErrorFallback';

const DiscoveryPage = lazy(() =>
  import('./components/discovery/DiscoveryPage').then(m => ({ default: m.DiscoveryPage }))
);
const ReviewPage = lazy(() =>
  import('./components/review/ReviewPage').then(m => ({ default: m.ReviewPage }))
);
const LiveRoleplayPage = lazy(() =>
  import('./components/live-roleplay/LiveRoleplayPage').then(m => ({ default: m.LiveRoleplayPage }))
);
const PathsPage = lazy(() =>
  import('./components/paths/PathsPage').then(m => ({ default: m.PathsPage }))
);
const ExercisesPage = lazy(() =>
  import('./components/exercises/ExercisesPage').then(m => ({ default: m.ExercisesPage }))
);
const LibraryPage = lazy(() =>
  import('./components/library/LibraryPage').then(m => ({ default: m.LibraryPage }))
);
const PracticePage = lazy(() =>
  import('./components/practice/PracticePage').then(m => ({ default: m.PracticePage }))
);
const PracticeHubPage = lazy(() =>
  import('./components/practice/PracticeHubPage').then(m => ({ default: m.PracticeHubPage }))
);
const SettingsPage = lazy(() =>
  import('./components/settings/SettingsPage').then(m => ({ default: m.SettingsPage }))
);
const ErrorDashboard = lazy(() =>
  import('./components/errors/ErrorDashboard').then(m => ({ default: m.ErrorDashboard }))
);
const HistoryPage = lazy(() =>
  import('./components/history/HistoryPage').then(m => ({ default: m.HistoryPage }))
);
const LessonPage = lazy(() =>
  import('./components/lesson/LessonPage').then(m => ({ default: m.LessonPage }))
);

function ProtectedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <DiscoveryPage />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback}>
      <BrowserRouter>
        <AuthProvider>
          <RuntimeConfigProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} errorElement={<ErrorFallback />} />
              <Route path="/migrate" element={<MigrationPage />} errorElement={<ErrorFallback />} />

              {/* Protected routes with Layout -- errorElement renders inside Layout (sidebar preserved) */}
              <Route path="/" element={<Layout />}>
                <Route index element={<ProtectedApp />} errorElement={<ErrorFallback />} />
                <Route path="review" element={<ReviewPage />} errorElement={<ErrorFallback />} />
                <Route path="live" element={<LiveRoleplayPage />} errorElement={<ErrorFallback />} />
                <Route path="paths" element={<PathsPage />} errorElement={<ErrorFallback />} />
                <Route path="exercises" element={<ExercisesPage />} errorElement={<ErrorFallback />} />
                <Route path="library" element={<LibraryPage />} errorElement={<ErrorFallback />} />
                <Route path="scripts" element={<PracticePage />} errorElement={<ErrorFallback />} />
                <Route path="practice" element={<PracticeHubPage />} errorElement={<ErrorFallback />} />
                <Route path="settings" element={<SettingsPage />} errorElement={<ErrorFallback />} />
                <Route path="errors" element={<ErrorDashboard />} errorElement={<ErrorFallback />} />
                <Route path="history" element={<HistoryPage />} errorElement={<ErrorFallback />} />
                <Route path="lesson/:lessonId" element={<LessonPage />} errorElement={<ErrorFallback />} />
              </Route>
            </Routes>
          </RuntimeConfigProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
