import axios from 'axios';
import { API_BASE_URL } from '../config';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const uploadFile = async (fileUri: string, fileName: string, title?: string) => {
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: 'text/plain',
  } as any);
  if (title) formData.append('title', title);

  return apiClient.post('/novels/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const analyzeNovel = (novelId: string) =>
  apiClient.post(`/novels/${novelId}/analyze`);

export const getTaskProgress = (taskId: string) =>
  apiClient.get(`/tasks/${taskId}/progress`);

export const getNovelAnalysis = (novelId: string) =>
  apiClient.get(`/novels/${novelId}/analysis`);

export const getEpisodes = (novelId: string) =>
  apiClient.get(`/novels/${novelId}/episodes`);

export const generateEpisodes = (novelId: string, targetDuration?: number) =>
  apiClient.post(`/novels/${novelId}/episodes/generate`, { targetDuration });
