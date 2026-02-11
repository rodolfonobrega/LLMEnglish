import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { DiscoveryPage } from './components/discovery/DiscoveryPage';
import { ReviewPage } from './components/review/ReviewPage';
import { LiveRoleplayPage } from './components/live-roleplay/LiveRoleplayPage';
import { LessonPage } from './components/lessons/LessonPage';
import { LibraryPage } from './components/library/LibraryPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { ErrorDashboard } from './components/errors/ErrorDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DiscoveryPage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="live" element={<LiveRoleplayPage />} />
          <Route path="lessons" element={<LessonPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="errors" element={<ErrorDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
