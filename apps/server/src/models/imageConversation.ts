// apps/server/src/models/imageConversation.ts
// v3.0.0: 生图 Agent 会话 model (image_conversations + image_generations)

import { queryAll, execute, queryOne } from './db';
import { generateUUID } from '../shared/utils';

export interface ImageConversationRow {
  id: string;
  user_id: string;
  status: string;
  mode: string;
  messages: any;                 // JSON array (AgentMessage[])
  plan: any;                     // JSON object
  plan_fields: any;              // v3.0.0.2: 10 字段标准模板 (PlanFields) JSON
  result_image_url: string | null;
  last_result_url: string | null; // v3.0.0.4: 持续对话用, 上次生成的图, 修改时作 i2i ref image
  aspect_ratio: string | null;
  style_id: string | null;
  charged_amount: number;
  error_msg: string | null;
  retry_count: number;
  created_at: number;
  updated_at: number;
}

export interface ImageGenerationRow {
  id: string;
  conversation_id: string;
  prompt: string | null;
  ref_image_urls: any;
  result_url: string | null;
  status: string;
  charged_amount: number;
  error_msg: string | null;
  created_at: number;
}

export class ImageConversationModel {
  async create(opts: { userId: string; mode?: string }): Promise<string> {
    const id = generateUUID();
    const now = Date.now();
    await execute(
      `INSERT INTO image_conversations (id, user_id, status, mode, messages, plan, charged_amount, retry_count, created_at, updated_at)
       VALUES (?, ?, 'idle', ?, '[]', null, 0, 0, ?, ?)`,
      [id, opts.userId, opts.mode || 'text2img', now, now]
    );
    return id;
  }

  async findById(id: string): Promise<ImageConversationRow | undefined> {
    return queryOne<ImageConversationRow>('SELECT * FROM image_conversations WHERE id = ?', [id]);
  }

  async findByUserId(userId: string, limit: number = 50): Promise<ImageConversationRow[]> {
    return queryAll<ImageConversationRow>(
      'SELECT * FROM image_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?',
      [userId, limit]
    );
  }

  async update(id: string, data: Partial<ImageConversationRow>): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [];
    const jsonFields: Record<string, string> = { messages: 'messages', plan: 'plan', ref_image_urls: 'ref_image_urls', plan_fields: 'plan_fields' };
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (col === 'last_result_url') {
        // 显式处理 last_result_url (key 含 result, 但不是 JSON)
        sets.push(`${col} = ?`);
        params.push(value);
        continue;
      }
      if (jsonFields[col] && typeof value !== 'string') {
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
    await execute(`UPDATE image_conversations SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  async delete(id: string): Promise<void> {
    await execute('DELETE FROM image_conversations WHERE id = ?', [id]);
  }
}

export class ImageGenerationModel {
  async create(opts: { conversationId: string; prompt: string; refImageUrls?: string[] }): Promise<string> {
    const id = generateUUID();
    await execute(
      `INSERT INTO image_generations (id, conversation_id, prompt, ref_image_urls, status, charged_amount, created_at)
       VALUES (?, ?, ?, ?, 'queued', 0, ?)`,
      [id, opts.conversationId, opts.prompt, JSON.stringify(opts.refImageUrls || []), Date.now()]
    );
    return id;
  }

  async update(id: string, data: Partial<ImageGenerationRow>): Promise<void> {
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
    await execute(`UPDATE image_generations SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  async findById(id: string): Promise<ImageGenerationRow | undefined> {
    return queryOne<ImageGenerationRow>('SELECT * FROM image_generations WHERE id = ?', [id]);
  }

  async findByConversationId(conversationId: string): Promise<ImageGenerationRow[]> {
    return queryAll<ImageGenerationRow>(
      'SELECT * FROM image_generations WHERE conversation_id = ? ORDER BY created_at DESC',
      [conversationId]
    );
  }
}

export const imageConversationModel = new ImageConversationModel();
export const imageGenerationModel = new ImageGenerationModel();
