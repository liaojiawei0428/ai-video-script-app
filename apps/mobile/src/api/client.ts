import axios from 'axios';
import { API_BASE_URL } from '../config';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Auth token 管理
let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

export function getAuthToken(): string | null {
  return _authToken;
}

// 请求拦截器自动带 token
apiClient.interceptors.request.use((config) => {
  if (_authToken) {
    config.headers.Authorization = `Bearer ${_authToken}`;
  }
  return config;
});

// 响应拦截器：401 清除登录状态+本地书架数据
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && _authToken) {
      _authToken = null;
      try {
        const store = require('../store/useNovelStore').useNovelStore.getState();
        store.setLoggedIn(false);
        store.setUserInfo(null);
        store.clearNovels();
      } catch {}
      try {
        require('../db/sqlite').clearAllLocalData().catch(() => {});
      } catch {}
      // 不清除SQLite token，让App.tsx重启后可重新验证
    }
    return Promise.reject(error);
  }
);

// ---- Novels ----

export const uploadFile = (
  fileUri: string,
  fileName: string,
  title?: string,
  onProgress?: (pct: number) => void
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE_URL + '/novels/upload');
    xhr.timeout = 120000;
    const formData = new FormData();
    formData.append('file', { uri: fileUri, name: fileName, type: 'text/plain' } as any);
    if (title) formData.append('title', title);
    formData.append('author', 'User');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ data: parsed });
        } else {
          reject(new Error(`服务器错误 (${xhr.status}): ${parsed?.error?.message || xhr.responseText?.slice(0, 100) || '未知错误'}`));
        }
      } catch {
        reject(new Error(`响应解析失败 (HTTP ${xhr.status}): ${xhr.responseText?.slice(0, 100) || '空响应'}`));
      }
    };
    xhr.onerror = () => reject(new Error('网络请求失败'));
    xhr.ontimeout = () => reject(new Error('请求超时（120秒）'));
    xhr.send(formData);
  });
};

export const deleteNovel = (novelId: string) =>
  apiClient.delete(`/novels/${novelId}`);

// ---- Analysis ----

export const getNovels = () =>
  apiClient.get('/novels');

export const getNovel = (novelId: string) =>
  apiClient.get(`/novels/${novelId}`);

export const analyzeNovel = (novelId: string) =>
  apiClient.post(`/novels/${novelId}/analyze`);

export const getNovelAnalysis = (novelId: string) =>
  apiClient.get(`/novels/${novelId}/analysis`);

export const updateNovel = (novelId: string, data: { genre?: string; theme?: string; style?: string; tone?: string }) =>
  apiClient.put(`/novels/${novelId}`, data);

export const updateCharacter = (characterId: string, data: { name?: string; appearance?: string; personality?: string; roleType?: string }) =>
  apiClient.put(`/novels/characters/${characterId}`, data);

// ---- Tasks ----

export const getTaskProgress = (taskId: string) =>
  apiClient.get(`/tasks/${taskId}/progress`);

// ---- Episodes ----

export const getEpisodes = (novelId: string, light = true) =>
  apiClient.get(`/novels/${novelId}/episodes?light=${light}`);

export const getEpisode = (episodeId: string) =>
  apiClient.get(`/episodes/${episodeId}`);

export const updateEpisode = (episodeId: string, data: any) =>
  apiClient.put(`/episodes/${episodeId}`, data);

export const generateEpisodes = (novelId: string, targetDuration?: number) =>
  apiClient.post(`/novels/${novelId}/episodes/generate`, { targetDuration });

// ---- v2.0.0 Outline & PlotGraph ----

export const generateOutline = (novelId: string) =>
  apiClient.post(`/novels/${novelId}/outline/generate`);

export const getOutline = (novelId: string) =>
  apiClient.get(`/novels/${novelId}/outline`);

export const updateOutline = (novelId: string, items: any[]) =>
  apiClient.put(`/novels/${novelId}/outline`, { items });

export const confirmOutline = (novelId: string) =>
  apiClient.post(`/novels/${novelId}/outline/confirm`);

export const generatePlotGraph = (novelId: string) =>
  apiClient.post(`/novels/${novelId}/plot-graph/generate`);

export const getPlotGraph = (novelId: string) =>
  apiClient.get(`/novels/${novelId}/plot-graph`);

// ---- v2.0.0 Export ----

export const exportEpisode = (episodeId: string, format: 'pdf' | 'docx' = 'pdf') =>
  apiClient.get(`/episodes/${episodeId}/export?format=${format}`);

// ---- v2.0.0 Asset Library ----

export const listAssets = (novelId: string) =>
  apiClient.get(`/novels/${novelId}/assets`);

// ---- Shots ----

export const getShots = (episodeId: string) =>
  apiClient.get(`/episodes/${episodeId}/shots`);

export const generateShots = (episodeId: string) =>
  apiClient.post(`/episodes/${episodeId}/shots/generate`);

export const regenerateEpisode = (episodeId: string) =>
  apiClient.post(`/novels/episodes/${episodeId}/regenerate`);

export const updateShot = (shotId: string, data: any) => {
  const { episodeId, ...rest } = data;
  return apiClient.put(`/episodes/${episodeId}/shots/${shotId}`, rest);
};

// ---- Users ----

export const register = (username: string, password: string, email?: string) =>
  apiClient.post('/users/register', { username, password, email });

export const login = (username: string, password: string) =>
  apiClient.post('/users/login', { username, password });

export const getProfile = () =>
  apiClient.get('/users/profile');

export const getUserHistory = () =>
  apiClient.get('/users/history');

export const updateProfile = (data: { nickname?: string; avatarUrl?: string }) =>
  apiClient.put('/users/profile', data);

export const changePassword = (oldPassword: string, newPassword: string) =>
  apiClient.put('/users/password', { oldPassword, newPassword });

// ---- Recharge ----

export const getQrCode = () =>
  apiClient.get('/recharge/qrcode');

export const submitRecharge = (amount: number) =>
  apiClient.post('/recharge/submit', { amount });

export const getRechargeHistory = () =>
  apiClient.get('/recharge/my');

export const getPricing = () =>
  apiClient.get('/users/pricing');

export const getBillingLogs = () =>
  apiClient.get('/users/billing');

// ---- Admin ----

export const adminLogin = (username: string, password: string) =>
  apiClient.post('/admin/login', { username, password });

export const adminDashboard = () =>
  apiClient.get('/admin/dashboard');

export const adminOrders = (status: string = 'pending') =>
  apiClient.get(`/admin/orders?status=${status}`);

export const adminApprove = (id: string) =>
  apiClient.post(`/admin/orders/${id}/approve`);

export const adminReject = (id: string, remark?: string) =>
  apiClient.post(`/admin/orders/${id}/reject`, { remark });

export const adminUsers = () =>
  apiClient.get('/admin/users');

export const adminUsersDetail = () =>
  apiClient.get('/admin/users-detail');

export const adminSendUserMsg = (userId: string, title: string, content: string) =>
  apiClient.post('/admin/send-message', { userId, title, content });

export const adminFeedbacks = (status?: string) =>
  apiClient.get(`/feedback/admin/list${status ? `?status=${status}` : ''}`);

export const adminReadFeedback = (id: string) =>
  apiClient.post(`/feedback/admin/${id}/read`);

export const adminReplyFeedback = (id: string, reply: string) =>
  apiClient.post(`/feedback/admin/${id}/reply`, { reply });

export const getUsage = () =>
  apiClient.get('/users/usage');

export const buyVip = () =>
  apiClient.post('/users/vip/buy');

// ---- Billing ----

export const estimateFee = (wordCount: number) =>
  apiClient.get(`/novels/estimate-fee?wordCount=${wordCount}`);

// ---- Feedback ----

export const submitFeedback = (content: string, contact?: string) =>
  apiClient.post('/feedback', { content, contact });

export const getMyFeedbacks = () =>
  apiClient.get('/feedback/my');

// ---- Notifications ----

export const getNotifications = () =>
  apiClient.get('/notifications');

export const getUnreadCount = () =>
  apiClient.get('/notifications/unread-count');

export const markNotificationRead = (id: string) =>
  apiClient.post(`/notifications/${id}/read`);

export const markAllNotificationsRead = () =>
  apiClient.post('/notifications/read-all');

export const sendAnnouncement = (title: string, content: string) =>
  apiClient.post('/notifications/admin/announcement', { title, content });

// ---- Export ----

export const exportNovelTxt = async (novelId: string): Promise<string> => {
  const response = await apiClient.get(`/novels/${novelId}/export?format=txt`);
  return response.data;
};

// ---- v2.0.0 角色一致性 ----

export const extractCharacterDescriptions = (novelId: string) =>
  apiClient.post(`/novels/${novelId}/characters/extract`);

export const getCharacters = (novelId: string) =>
  apiClient.get(`/novels/${novelId}/characters`);

export const getCharacter = (characterId: string) =>
  apiClient.get(`/characters/${characterId}`);

export const confirmCharacter = (
  characterId: string,
  data: { description: any; extraDescription: any }
) => apiClient.post(`/characters/${characterId}/confirm`, data);

export const generateCharacterImages = (
  characterId: string,
  onlyAngles?: Array<'front_bust' | 'side_bust' | 'full_body'>
) => apiClient.post(`/characters/${characterId}/generate-images`, { onlyAngles });

export const generateShotImage = (shotId: string) =>
  apiClient.post(`/shots/${shotId}/generate-image`);

export const getStylePresets = () =>
  apiClient.get('/style-presets');
