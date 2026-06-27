import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getCachedETag, getCachedBody, setCachedResponse } from '../db/cacheMeta';

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

// ======== S72 batch 17 v3.0.46 BUG-116 缓存方案 B.3: ETag/304 axios interceptor ========
// 跨端铁律 4++ (跟 web 端 axios interceptor 1:1 镜像)
//
// 流程:
//   1. 请求拦截器: GET 请求自动带 If-None-Match (从 cache_meta 读上次 ETag)
//   2. 响应拦截器:
//      a) 收到 200 → 存 ETag + body 到 cache_meta (下次可命中)
//      b) 收到 304 → 从 cache_meta 读上次 body, 构造假 200 响应返给调用方
//
// 配套 (跨端铁律 4++ 跟 web 1:1):
//   - web 端 axios interceptor 实现相同逻辑 (B.5 阶段)
//   - cache_meta schema/API 1:1 (B.2 阶段已实现)
//   - 阶段 A hash 比对 + 阶段 B ETag/304 双保险 (client-side + server-side)

// 构造完整 URL 作为 cache key (包括 query string)
function getCacheKey(config: any): string | null {
  if (!config.url) return null;
  const baseURL = config.baseURL || '';
  // 跳过 POST/PUT/DELETE 等非幂等操作
  const method = (config.method || 'get').toLowerCase();
  if (method !== 'get' && method !== 'head') return null;
  const url = config.url.startsWith('http') ? config.url : baseURL + (config.url.startsWith('/') ? config.url : '/' + config.url);
  return url + (config.params ? '?' + new URLSearchParams(config.params).toString() : '');
}

// 请求拦截器: 自动带 If-None-Match (从 cache_meta 读)
apiClient.interceptors.request.use(async (config) => {
  if (_authToken) {
    config.headers.Authorization = `Bearer ${_authToken}`;
  }

  // 🆕 BUG-116 B.3: GET 请求自动带 If-None-Match
  const cacheKey = getCacheKey(config);
  if (cacheKey) {
    try {
      const etag = await getCachedETag(cacheKey);
      if (etag) {
        config.headers['If-None-Match'] = etag;
      }
    } catch (e) {
      // cache_meta 读取失败不影响正常请求
      console.warn('[apiClient] getCachedETag failed', cacheKey, e);
    }
  }

  return config;
});

// 响应拦截器: 处理 ETag/304 + 401
apiClient.interceptors.response.use(
  async (response) => {
    // 🆕 BUG-116 B.3: 200 响应自动存 ETag + body 到 cache_meta
    const cacheKey = getCacheKey(response.config);
    const etag = response.headers.etag;
    if (cacheKey && etag && response.data !== undefined) {
      try {
        await setCachedResponse(cacheKey, etag, JSON.stringify(response.data), response.status);
      } catch (e) {
        console.warn('[apiClient] setCachedResponse failed', cacheKey, e);
      }
    }
    return response;
  },
  async (error) => {
    // 🆕 BUG-116 B.3: 304 响应自动从 cache_meta 返 body (server 不传 body)
    if (error?.response?.status === 304) {
      const cacheKey = getCacheKey(error.response.config);
      if (cacheKey) {
        try {
          const cached = await getCachedBody(cacheKey);
          if (cached) {
            // 构造 axios response 对象, status 200 + 用缓存 body 解析
            return Promise.resolve({
              ...error.response,
              status: 200,
              statusText: 'OK (from cache_meta 304)',
              data: JSON.parse(cached.body),
              headers: { ...error.response.headers, etag: cached.etag, 'x-cache': 'HIT-304' },
            } as any);
          }
        } catch (e) {
          console.warn('[apiClient] getCachedBody failed', cacheKey, e);
        }
      }
    }

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

// v3.0.0 (S58): 头像上传 (multipart/form-data) - 走 S57b 加的 POST /users/avatar/upload
export const uploadAvatar = (
  fileUri: string,
  fileName: string,
  mimeType: string = 'image/jpeg'
): Promise<{ url: string; filename: string; size: number; mimetype: string }> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE_URL + '/users/avatar/upload');
    xhr.timeout = 30000;
    const formData = new FormData();
    formData.append('avatar', { uri: fileUri, name: fileName, type: mimeType } as any);
    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = parsed?.data || parsed;
          resolve({ url: data.url, filename: data.filename, size: data.size, mimetype: data.mimetype });
        } else {
          reject(new Error(parsed?.error?.message || `上传失败 (${xhr.status})`));
        }
      } catch {
        reject(new Error(`响应解析失败 (HTTP ${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('网络请求失败'));
    xhr.ontimeout = () => reject(new Error('上传超时（30秒）'));
    xhr.send(formData);
  });
};

// ---- Recharge ----

export const getQrCode = () =>
  apiClient.get('/recharge/qrcode');

export const submitRecharge = (amount: number) =>
  apiClient.post('/recharge/submit', { amount });

// v3.0.37 (S72 batch 7 BUG-097): 用户点"我已付款"通知 admin (跟 web BUG-092 配套, 铁律 4++ 跨项目通用同步)
export const notifyRechargePaid = (id: string) =>
  apiClient.post(`/recharge/${id}/notify-paid`);

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

// v3.0.37 (S72 batch 7 BUG-097): admin 默认查 'user_notified' 取代 'pending' (跟 web BUG-094 配套, 铁律 4++ 跨项目通用同步)
export const adminOrders = (status: string = 'user_notified') =>
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

// v3.0.3 (S58 P5 BUG-009): CharacterListScreen 调, 之前未导出 → undefined 报错 → 列表空白
// server 路由: GET /api/novels/:novelId/characters (routes/characters.ts:23, mount /api/characterRoutes)
export const listCharactersByNovel = (novelId: string) =>
  apiClient.get(`/novels/${novelId}/characters`);

// v3.0.28 (S62 P1): 跟 web 端 `backfillCharactersApi` 对齐 — 从已有 analysisReport 重新提取角色
// server 路由: POST /api/novels/:novelId/backfill-characters (routes/novels.ts:42)
// 之前 mobile 没有, 列表页没"重新分析角色"按钮, 用户反馈"角色库为空没法刷新"
export const backfillCharactersApi = (novelId: string) =>
  apiClient.post(`/novels/${novelId}/backfill-characters`);

// v3.0.28 (S62 P1): 跟 web 端 `updateCharacterFullApi` 对齐 — 完整更新角色
//   (name/aliases/roleType/description/extraDescription)
// server 路由: PUT /api/novels/characters/:characterId/full (routes/novels.ts:56)
// 之前 mobile 只有 `updateCharacter` (PUT /novels/characters/:cid) 仅支持 name/appearance/personality/roleType,
// 描述 textarea 编辑后无法保存
export const updateCharacterFullApi = (
  characterId: string,
  data: {
    name?: string;
    aliases?: string[];
    roleType?: string;
    description?: string;
    extraDescription?: string;
  }
) => apiClient.put(`/novels/characters/${characterId}/full`, data);

// ---- v3.0.0 Image Agent (生图) - 跟 web src/lib/api.ts imageAgent* 1:1 对齐 ----
// v3.0.24 (S60 P2 BUG-041): 补全 image/video-agent 12 个 API
//   之前 mobile ImageAgentScreen 调 /video-agent/confirm 错的 (复制粘贴没改)
//   VideoAgentScreen 只显示 URL 60 字符 (没 Image/WebView)
//   现在: 6 + 6 = 12 helper, screen 直接调这些
export const imageAgentCreateConversationApi = () =>
  apiClient.post('/image-agent/conversations');
export const imageAgentChatApi = (conversationId: string, parts: any[], aspectRatio?: string) =>
  apiClient.post('/image-agent/chat', { conversationId, parts, aspectRatio });
export const imageAgentConfirmApi = (conversationId: string) =>
  apiClient.post('/image-agent/confirm', { conversationId });
export const imageAgentTranslatePlanApi = (conversationId: string) =>
  apiClient.post('/image-agent/translate-plan', { conversationId });
export const imageAgentUpdatePlanFieldsApi = (conversationId: string, fields: Record<string, string>) =>
  apiClient.put('/image-agent/plan-fields', { conversationId, fields });
export const imageAgentHistoryApi = (limit = 50) =>
  apiClient.get('/image-agent/conversations', { params: { limit } });
export const imageAgentGetApi = (id: string) =>
  apiClient.get(`/image-agent/conversations/${id}`);
export const imageAgentDeleteApi = (id: string) =>
  apiClient.delete(`/image-agent/conversations/${id}`);

// ---- v3.0.0 Video Agent (视频) - 跟 web src/lib/api.ts videoAgent* 1:1 对齐 ----
export const videoAgentCreateConversationApi = () =>
  apiClient.post('/video-agent/conversations');
export const videoAgentChatApi = (conversationId: string, parts: any[], aspectRatio?: string, durationSec?: number) =>
  apiClient.post('/video-agent/chat', { conversationId, parts, aspectRatio, durationSec });
export const videoAgentConfirmApi = (conversationId: string) =>
  apiClient.post('/video-agent/confirm', { conversationId });
export const videoAgentHistoryApi = (limit = 50) =>
  apiClient.get('/video-agent/conversations', { params: { limit } });
export const videoAgentGetApi = (id: string) =>
  apiClient.get(`/video-agent/conversations/${id}`);
export const videoAgentDeleteApi = (id: string) =>
  apiClient.delete(`/video-agent/conversations/${id}`);
