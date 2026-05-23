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

// 响应拦截器：401 清除内存登录状态（不清 SQLite，避免瞬态 401 丢失持久化 token）
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && _authToken) {
      _authToken = null;
      try {
        const store = require('../store/useNovelStore').useNovelStore.getState();
        store.setLoggedIn(false);
        store.setUserInfo(null);
      } catch {}
      // 不再清除 SQLite，让 App.tsx 重启后可以重新验证
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

export const updateProfile = (data: { nickname?: string; avatarUrl?: string }) =>
  apiClient.put('/users/profile', data);

export const changePassword = (oldPassword: string, newPassword: string) =>
  apiClient.put('/users/password', { oldPassword, newPassword });

export const recharge = () =>
  apiClient.post('/users/recharge');

export const getUsage = () =>
  apiClient.get('/users/usage');

// ---- Export ----

export const exportNovelTxt = async (novelId: string): Promise<string> => {
  const response = await apiClient.get(`/novels/${novelId}/export?format=txt`);
  return response.data;
};
