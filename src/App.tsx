import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DiscoveryPage />} />
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
    </BrowserRouter>
  );
}

export default App;
