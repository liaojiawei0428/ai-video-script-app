// apps/server/src/models/videoConversation.ts
// v3.0.0: 视频 Agent 会话 model (video_conversations + video_generations)

import { queryAll, execute, queryOne } from './db';
import { generateUUID } from '../shared/utils';

export interface VideoConversationRow {
  id: string;
  user_id: string;
  status: string;
  mode: string;
  messages: any;
  plan: any;
  result_video_url: string | null;
  local_video_path: string | null;        // v3.0.0.1: 视频本地缓存路径, shipin-APP 拉 agens 存到 uploads/videos/{userId}/
  last_result_url: string | null;        // v3.0.0.15: 持续对话的 reference (跟图片 agent 一样, 写 result_video_url 同步)
  duration_sec: number;
  resolution: string | null;
  fps: number;
  task_id: string | null;
  video_id: string | null;
  retry_count: number;
  charged_amount: number;
  billing_status: string;                                          // v3.0.31 (S69 BUG-072 E): 'settled' / 'unsettled'
  error_msg: string | null;
  created_at: number;
  updated_at: number;
}

export interface VideoGenerationRow {
  id: string;
  conversation_id: string;
  prompt: string | null;
  ref_image_urls: any;
  result_url: string | null;
  status: string;
  duration_sec: number | null;
  resolution: string | null;
  charged_amount: number;
  error_msg: string | null;
  created_at: number;
}

export class VideoConversationModel {
  async create(opts: { userId: string; mode?: string }): Promise<string> {
    const id = generateUUID();
    const now = Date.now();
    await execute(
      `INSERT INTO video_conversations (id, user_id, status, mode, messages, plan, duration_sec, resolution, fps, retry_count, charged_amount, created_at, updated_at)
       VALUES (?, ?, 'idle', ?, '[]', null, 5, '1152x768', 24, 0, 0, ?, ?)`,
      [id, opts.userId, opts.mode || 'text2vid', now, now]
    );
    return id;
  }

  async findById(id: string): Promise<VideoConversationRow | undefined> {
    return queryOne<VideoConversationRow>('SELECT * FROM video_conversations WHERE id = ?', [id]);
  }

  async findByUserId(userId: string, limit: number = 50): Promise<VideoConversationRow[]> {
    return queryAll<VideoConversationRow>(
      'SELECT * FROM video_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?',
      [userId, limit]
    );
  }

  async update(id: string, data: Partial<VideoConversationRow>): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if ((col === 'messages' || col === 'plan' || col === 'ref_image_urls') && typeof value !== 'string') {
        sets.push(`${col} = ?`);
        params.push(JSON.stringify(value));
      } else {
        sets.push(`${col} = ?`);
        params.push(value);
      }
    }
    if (sets.length === 0) return;
    sets.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);
    await execute(`UPDATE video_conversations SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  async delete(id: string): Promise<void> {
    await execute('DELETE FROM video_conversations WHERE id = ?', [id]);
  }
}

export class VideoGenerationModel {
  async create(opts: { conversationId: string; prompt: string; refImageUrls?: string[]; durationSec?: number; resolution?: string }): Promise<string> {
    const id = generateUUID();
    await execute(
      `INSERT INTO video_generations (id, conversation_id, prompt, ref_image_urls, status, duration_sec, resolution, charged_amount, created_at)
       VALUES (?, ?, ?, ?, 'queued', ?, ?, 0, ?)`,
      [id, opts.conversationId, opts.prompt, JSON.stringify(opts.refImageUrls || []), opts.durationSec || 5, opts.resolution || '1152x768', Date.now()]
    );
    return id;
  }

  async update(id: string, data: Partial<VideoGenerationRow>): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (col === 'ref_image_urls' && typeof value !== 'string') {
        sets.push(`${col} = ?`);
        params.push(JSON.stringify(value));
      } else {
        sets.push(`${col} = ?`);
        params.push(value);
      }
    }
    if (sets.length === 0) return;
    params.push(id);
    await execute(`UPDATE video_generations SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  async findById(id: string): Promise<VideoGenerationRow | undefined> {
    return queryOne<VideoGenerationRow>('SELECT * FROM video_generations WHERE id = ?', [id]);
  }
}

export const videoConversationModel = new VideoConversationModel();
export const videoGenerationModel = new VideoGenerationModel();
