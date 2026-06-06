import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { BookshelfPage } from './pages/BookshelfPage';
import { ScriptDetailPage } from './pages/ScriptDetailPage';
import { EpisodeDetailPage } from './pages/EpisodeDetailPage';
import { RechargePage } from './pages/RechargePage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { CharacterListPage } from './pages/CharacterListPage';
import { CharacterDetailPage } from './pages/CharacterDetailPage';
import { OutlinePage } from './pages/OutlinePage';
import { PlotGraphPage } from './pages/PlotGraphPage';
import { AssetLibraryPage } from './pages/AssetLibraryPage';
import { TaskProgressPage } from './pages/TaskProgressPage';
import { TasksPage } from './pages/TasksPage';
import { useAuthStore } from './store/auth';

function Protected({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<BookshelfPage />} />
        <Route path="/novels/:id" element={<ScriptDetailPage />} />
        <Route path="/novels/:id/characters" element={<CharacterListPage />} />
        <Route path="/characters/:id" element={<CharacterDetailPage />} />
        <Route path="/novels/:id/outline" element={<OutlinePage />} />
        <Route path="/novels/:id/plot-graph" element={<PlotGraphPage />} />
        <Route path="/novels/:id/assets" element={<AssetLibraryPage />} />
        <Route path="/progress/:novelId" element={<TaskProgressPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/episodes/:id" element={<EpisodeDetailPage />} />
        <Route path="/recharge" element={<RechargePage />} />
        <Route path="/assistant" element={<AIAssistantPage />} />
        <Route path="/assistant/:novelId" element={<AIAssistantPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
