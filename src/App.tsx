import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { SettingsPage } from './components/settings/SettingsPage';
import { ErrorDashboard } from './components/errors/ErrorDashboard';
import { HistoryPage } from './components/history/HistoryPage';

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
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/migrate" element={<MigrationPage />} />

          {/* Protected routes with Layout */}
          <Route path="/" element={<Layout />}>
            <Route index element={<ProtectedApp />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="live" element={<LiveRoleplayPage />} />
            <Route path="paths" element={<PathsPage />} />
            <Route path="exercises" element={<ExercisesPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="scripts" element={<PracticePage />} />
            <Route path="practice" element={<PracticePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="errors" element={<ErrorDashboard />} />
            <Route path="history" element={<HistoryPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
