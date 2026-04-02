import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';
import { LoginPage } from './components/auth/LoginPage';
import { MigrationPage } from './components/auth/MigrationPage';
import { DiscoveryPage } from './components/discovery/DiscoveryPage';
import { ReviewPage } from './components/review/ReviewPage';
import { LiveRoleplayPage } from './components/live-roleplay/LiveRoleplayPage';
import { PathsPage } from './components/paths/PathsPage';
import { ExercisesPage } from './components/exercises/ExercisesPage';
import { LibraryPage } from './components/library/LibraryPage';
import { PracticePage } from './components/practice/PracticePage';
import { PracticeHubPage } from './components/practice/PracticeHubPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { ErrorDashboard } from './components/errors/ErrorDashboard';
import { HistoryPage } from './components/history/HistoryPage';
import { AppErrorFallback } from './components/errors/AppErrorFallback';
import { ErrorFallback } from './components/errors/ErrorFallback';

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
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
