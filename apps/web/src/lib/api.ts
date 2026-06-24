import axios from 'axios';
import { useAuthStore } from '../store/auth';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

// v3.0.0: 5 分钟超时 (LLM 多轮 + agnes image/video 真生成可能 1-3 分钟, 原来 30s 必超时)
export const apiClient = axios.create({ baseURL, timeout: 300000 });

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
// v3.0.1 (S56): 个人中心 - 更新用户资料 (昵称/头像)
export const updateProfileApi = (data: { nickname?: string; avatarUrl?: string }) =>
  apiClient.put('/users/profile', data);
// v3.0.2 (S57): 头像上传 (multipart/form-data) → 拿到 url 再 PATCH /users/profile
export const uploadAvatarApi = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return apiClient.post('/users/avatar/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};
// v2.5.34: 修改密码 (后端: PUT /users/password, auth middleware)
export const changePasswordApi = (oldPassword: string, newPassword: string) =>
  apiClient.put('/users/password', { oldPassword, newPassword });
// 后端无独立 /users/balance → 用 /users/profile 返回中的 balance 字段

// === Pricing (v3.0.1 S56) ===
// 公开端点, 不需 auth, 返回计费矩阵 (视频/图片)
export const getPricingApi = () => apiClient.get('/pricing');

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

// v3.0.0: Agent 参考图上传 (image-agent / video-agent 通用)
export const uploadAgentReferenceApi = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return apiClient.post('/agent/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
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
// v2.5.19: 漫画生成
// v2.5.27: 新增 useCharacterLibrary 参数 (默认 true), 角色库三视图 DNA 注入
export const generateComicApi = (id: string, useCharacterLibrary = true) =>
  apiClient.post(`/episodes/${id}/comic/generate`, { useCharacterLibrary });
export const getComicApi = (id: string) => apiClient.get(`/episodes/${id}/comic`);

// === Recharge (后端 /recharge/submit, /recharge/my) ===
export const createRechargeApi = (amount: number, method: string = 'wxpay') =>
  apiClient.post('/recharge/submit', { amount, method });
export const getRechargeHistoryApi = () => apiClient.get('/recharge/my');

// === Billing (v3.0.32 BUG-078 S71: 账单明细, 含充值 + 消费 + 免费) ===
// 旧版只调 getRechargeHistoryApi (只显示充值, 没消费记录) — web 端"账单明细"页面 BUG-078 修法
export const getBillingTransactionsApi = (params?: { limit?: number; offset?: number; type?: 'charge' | 'consumption' | 'refund'; refType?: string }) =>
  apiClient.get('/billing/transactions', { params });
export const getBillingSummaryApi = () => apiClient.get('/billing/summary');

// === VIP (S52: 跟 Mobile 1:1 一致, 后端 POST /users/vip/buy ¥10/年) ===
export const buyVipApi = () => apiClient.post('/users/vip/buy');

// === Tasks ===
export const getTaskProgressApi = (taskId: string) => apiClient.get(`/tasks/${taskId}/progress`);

// === Delete ===
export const deleteNovelApi = (id: string) => apiClient.delete(`/novels/${id}`);

// === AI Assistant (聊天) ===
export const chatApi = (messages: Array<{ role: string; content: string }>) =>
  apiClient.post('/chat/', { messages });

// === v3.0.0.2 Image Agent (生图) ===
// 端点: POST /api/image-agent/conversations, /chat, /confirm, /translate-plan
//       PUT  /api/image-agent/plan-fields
//       GET  /api/image-agent/conversations, /conversations/:id
export const imageAgentCreateConversationApi = () =>
  apiClient.post('/image-agent/conversations');
export const imageAgentChatApi = (conversationId: string, parts: unknown[], aspectRatio?: string) =>
  apiClient.post('/image-agent/chat', { conversationId, parts, aspectRatio });
export const imageAgentConfirmApi = (conversationId: string) =>
  apiClient.post('/image-agent/confirm', { conversationId });
// v3.0.0.2: 中文方案 → 英文 prompt 翻译
export const imageAgentTranslatePlanApi = (conversationId: string) =>
  apiClient.post('/image-agent/translate-plan', { conversationId });
// v3.0.0.2: 用户改 10 字段
export const imageAgentUpdatePlanFieldsApi = (conversationId: string, fields: Record<string, string>) =>
  apiClient.put('/image-agent/plan-fields', { conversationId, fields });
export const imageAgentHistoryApi = (limit = 50) =>
  apiClient.get('/image-agent/conversations', { params: { limit } });
export const imageAgentGetApi = (id: string) =>
  apiClient.get(`/image-agent/conversations/${id}`);
// v3.0.0.17: 永久删除单条会话 (含 image_generations 审计)
export const imageAgentDeleteApi = (id: string) =>
  apiClient.delete(`/image-agent/conversations/${id}`);

// === v3.0.0 Video Agent (视频) ===
export const videoAgentCreateConversationApi = () =>
  apiClient.post('/video-agent/conversations');
export const videoAgentChatApi = (conversationId: string, parts: unknown[], aspectRatio?: string, durationSec?: number) =>
  apiClient.post('/video-agent/chat', { conversationId, parts, aspectRatio, durationSec });
export const videoAgentConfirmApi = (conversationId: string) =>
  apiClient.post('/video-agent/confirm', { conversationId });
export const videoAgentHistoryApi = (limit = 50) =>
  apiClient.get('/video-agent/conversations', { params: { limit } });
export const videoAgentGetApi = (id: string) =>
  apiClient.get(`/video-agent/conversations/${id}`);
// v3.0.0.17: 永久删除单条会话
export const videoAgentDeleteApi = (id: string) =>
  apiClient.delete(`/video-agent/conversations/${id}`);

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
