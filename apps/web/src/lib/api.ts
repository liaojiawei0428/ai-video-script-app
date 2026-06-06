import axios from 'axios';
import { useAuthStore } from '../store/auth';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({ baseURL, timeout: 30000 });

apiClient.interceptors.request.use((config) => {
  // v2.5.17: 如果请求已自带 Authorization (如 admin token), 不覆盖
  if (!config.headers.Authorization) {
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(err);
  },
);

// === Auth (后端实际为 /users/login, /users/register) ===
export const loginApi = (username: string, password: string) => apiClient.post('/users/login', { username, password });
// 后端 /users/register 不需要验证码
export const registerApi = (username: string, password: string) => apiClient.post('/users/register', { username, password });
// sendCodeApi / logoutApi: 后端无对应端点 → 前端不调用 (LoginPage 改用 username+password 注册, 退出只清 token)

// === User ===
export const getMeApi = () => apiClient.get('/users/profile');
// 后端无独立 /users/balance → 用 /users/profile 返回中的 balance 字段

// === Novels ===
export const getNovelsApi = (q?: string, status?: string) =>
  apiClient.get('/novels', { params: { q, status } });
export const getNovelApi = (id: string) => apiClient.get(`/novels/${id}`);
export const getNovelAnalysisApi = (id: string) => apiClient.get(`/novels/${id}/analysis`);
// v2.5.11: 编辑小说元信息 (genre/theme/style/tone)
export const updateNovelMetaApi = (id: string, data: { genre?: string; theme?: string; style?: string; tone?: string }) =>
  apiClient.put(`/novels/${id}/meta`, data);
// v2.5.11: 编辑完整 analysis_report
export const updateAnalysisReportApi = (id: string, analysisReport: string) =>
  apiClient.put(`/novels/${id}/analysis-report`, { analysisReport });
export const uploadNovelApi = (file: File, title?: string, styleId?: string) => {
  const fd = new FormData();
  fd.append('file', file);
  if (title) fd.append('title', title);
  if (styleId) fd.append('styleId', styleId);
  return apiClient.post('/novels/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const analyzeNovelApi = (id: string) => apiClient.post(`/novels/${id}/analyze`);
export const getEpisodesApi = (id: string) => apiClient.get(`/novels/${id}/episodes`);
export const generateEpisodesApi = (id: string, continueFlag = false) =>
  apiClient.post(`/novels/${id}/episodes/generate`, { continue: continueFlag });

// === v2.0.0 Outline & PlotGraph ===
export const generateOutlineApi = (id: string) => apiClient.post(`/novels/${id}/outline/generate`);
export const getOutlineApi = (id: string) => apiClient.get(`/novels/${id}/outline`);
export const updateOutlineApi = (id: string, items: any[]) => apiClient.put(`/novels/${id}/outline`, { items });
export const confirmOutlineApi = (id: string) => apiClient.post(`/novels/${id}/outline/confirm`);
export const generatePlotGraphApi = (id: string) => apiClient.post(`/novels/${id}/plot-graph/generate`);
export const getPlotGraphApi = (id: string) => apiClient.get(`/novels/${id}/plot-graph`);

// === Characters ===
export const listCharactersApi = (id: string) => apiClient.get(`/novels/${id}/characters`);
// v2.5.10: 从已有 analysis_report 回填角色 (修复"角色库为空"历史问题)
export const backfillCharactersApi = (id: string) => apiClient.post(`/novels/${id}/backfill-characters`);
// 后端无独立 /novels/:id/assets → 用 characters 表 (资产库=角色)
export const listAssetsApi = (id: string) => apiClient.get(`/novels/${id}/characters`);
export const getCharacterApi = (cid: string) => apiClient.get(`/characters/${cid}`);
// v2.5.11: 编辑角色完整信息 (含 description/extraDescription)
export const updateCharacterFullApi = (cid: string, data: any) =>
  apiClient.put(`/novels/characters/${cid}/full`, data);

// === Episodes ===
export const getEpisodeApi = (id: string) => apiClient.get(`/episodes/${id}`);
export const updateEpisodeApi = (id: string, data: any) => apiClient.put(`/episodes/${id}`, data);
export const generateShotsApi = (id: string) => apiClient.post(`/episodes/${id}/shots/generate`);
export const getShotsApi = (id: string) => apiClient.get(`/episodes/${id}/shots`);
export const exportEpisodeApi = (id: string, format: 'pdf' | 'docx' = 'pdf') =>
  apiClient.get(`/episodes/${id}/export?format=${format}`);
// v2.5.12: 编辑镜头 (含完整越权校验)
export const updateShotApi = (shotId: string, data: any) => apiClient.put(`/shots/${shotId}`, data);

// === Recharge (后端 /recharge/submit, /recharge/my) ===
export const createRechargeApi = (amount: number, method: string = 'wxpay') =>
  apiClient.post('/recharge/submit', { amount, method });
export const getRechargeHistoryApi = () => apiClient.get('/recharge/my');

// === Tasks ===
export const getTaskProgressApi = (taskId: string) => apiClient.get(`/tasks/${taskId}/progress`);

// === Delete ===
export const deleteNovelApi = (id: string) => apiClient.delete(`/novels/${id}`);

// === AI Assistant (聊天) ===
export const chatApi = (messages: Array<{ role: string; content: string }>) =>
  apiClient.post('/chat/', { messages });

// === Notifications ===
export const getNotificationsApi = () => apiClient.get('/notifications/');
export const getUnreadCountApi = () => apiClient.get('/notifications/unread-count');
export const markNotificationReadApi = (id: string) => apiClient.post(`/notifications/${id}/read`);
export const markAllReadApi = () => apiClient.post('/notifications/read-all');

// === Feedback ===
export const createFeedbackApi = (content: string, type: string = 'suggestion') =>
  apiClient.post('/feedback/', { content, type });
export const getMyFeedbacksApi = () => apiClient.get('/feedback/my');

// === Admin ===
// Admin API 使用独立的 admin_token, 不走普通用户 token
const getAdminHeaders = () => {
  const token = localStorage.getItem('admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const adminLoginApi = (username: string, password: string) =>
  apiClient.post('/admin/login', { username, password });
export const adminDashboardApi = () => apiClient.get('/admin/dashboard', { headers: getAdminHeaders() });
export const adminOrdersApi = (status: string = 'pending') =>
  apiClient.get(`/admin/orders?status=${status}`, { headers: getAdminHeaders() });
export const adminApproveApi = (id: string) =>
  apiClient.post(`/admin/orders/${id}/approve`, {}, { headers: getAdminHeaders() });
export const adminRejectApi = (id: string, remark?: string) =>
  apiClient.post(`/admin/orders/${id}/reject`, { remark }, { headers: getAdminHeaders() });
export const adminUsersDetailApi = () => apiClient.get('/admin/users-detail', { headers: getAdminHeaders() });
export const adminSendMsgApi = (userId: string, title: string, content: string) =>
  apiClient.post('/admin/send-message', { userId, title, content }, { headers: getAdminHeaders() });
export const sendAnnouncementApi = (title: string, content: string) =>
  apiClient.post('/notifications/admin/announcement', { title, content }, { headers: getAdminHeaders() });
export const adminActiveTasksApi = () => apiClient.get('/admin/active-tasks', { headers: getAdminHeaders() });
export const adminMaintenanceApi = (enable: boolean) =>
  apiClient.put(`/admin/maintenance?enable=${enable}`, {}, { headers: getAdminHeaders() });
