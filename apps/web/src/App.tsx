import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { BookshelfPage } from './pages/BookshelfPage';
import { ScriptDetailPage } from './pages/ScriptDetailPage';
import { EpisodeDetailPage } from './pages/EpisodeDetailPage';
import { RechargePage } from './pages/RechargePage';
import { AccountPage } from './pages/AccountPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { CharacterListPage } from './pages/CharacterListPage';
import { CharacterDetailPage } from './pages/CharacterDetailPage';
import { ErrorBoundary } from './components/ui/error-boundary';
import { OutlinePage } from './pages/OutlinePage';
import { PlotGraphPage } from './pages/PlotGraphPage';
import { AssetLibraryPage } from './pages/AssetLibraryPage';
import { TaskProgressPage } from './pages/TaskProgressPage';
import { TasksPage } from './pages/TasksPage';
import { ImageAgentPage } from './pages/ImageAgentPage';
import { VideoAgentPage } from './pages/VideoAgentPage';
import { VipCenterPage } from './pages/VipCenterPage';
import { ProfilePage } from './pages/ProfilePage';  // v3.0.1 (S56) 个人中心
import { BillingPage } from './pages/BillingPage';   // v3.0.1 (S56) 账单明细
import { PricingPage } from './pages/PricingPage';   // v3.0.1 (S56) 收费标准
import { SettingsPage } from './pages/SettingsPage'; // v3.0.1 (S56) 设置
import { FeedbackPage } from './pages/FeedbackPage'; // v3.0.1 (S56) 意见反馈
import { AboutPage } from './pages/AboutPage';       // v3.0.1 (S56) 关于我们
import { DownloadPage } from './pages/DownloadPage'; // v3.0.0 (S58) APP 下载页
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { useAuthStore } from './store/auth';

function Protected({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminProtected({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('admin_token');
  if (!token) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* 普通用户 */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* v3.0.0 (S58): APP 下载页 (公开, 无需登录) */}
      <Route path="/download" element={<DownloadPage />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<BookshelfPage />} />
        <Route path="/novels/:id" element={<ScriptDetailPage />} />
        <Route path="/novels/:id/characters" element={<CharacterListPage />} />
        <Route path="/characters/:id" element={<ErrorBoundary onReset={() => window.location.reload()}><CharacterDetailPage /></ErrorBoundary>} />
        <Route path="/novels/:id/outline" element={<OutlinePage />} />
        <Route path="/novels/:id/plot-graph" element={<PlotGraphPage />} />
        <Route path="/novels/:id/assets" element={<AssetLibraryPage />} />
        <Route path="/progress/:novelId" element={<TaskProgressPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/episodes/:id" element={<EpisodeDetailPage />} />
        <Route path="/recharge" element={<RechargePage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/assistant" element={<AIAssistantPage />} />
        <Route path="/assistant/:novelId" element={<AIAssistantPage />} />
        {/* v3.0.0 Agent 矩阵: 生图 + 视频 */}
        <Route path="/image-agent" element={<ImageAgentPage />} />
        <Route path="/image-agent/:conversationId" element={<ImageAgentPage />} />
        <Route path="/video-agent" element={<VideoAgentPage />} />
        <Route path="/video-agent/:conversationId" element={<VideoAgentPage />} />
        {/* v3.0.0.32 (S52): VIP 会员中心 (跟 Mobile HomeScreen 一致) */}
        <Route path="/vip" element={<VipCenterPage />} />
        {/* v3.0.1 (S56): 个人中心 + 5 个二级页 */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Route>

      {/* 管理员 */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminProtected><AdminDashboardPage /></AdminProtected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
