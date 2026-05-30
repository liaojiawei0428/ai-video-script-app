import { queryOne, queryAll, execute, poolQuery } from './db';
import { generateUUID } from '../shared/utils';

export interface Feedback {
  id: string;
  userId: string;
  username: string;
  content: string;
  contact: string;
  status: 'pending' | 'read' | 'replied';
  adminReply: string;
  createdAt: number;
  updatedAt: number;
}

export class FeedbackModel {
  async create(userId: string, username: string, content: string, contact: string): Promise<Feedback> {
    const id = generateUUID();
    const now = Date.now();
    await execute(
      `INSERT INTO feedbacks (id, user_id, username, content, contact, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [id, userId, username, content, contact, now, now]
    );
    return { id, userId, username, content, contact, status: 'pending', adminReply: '', createdAt: now, updatedAt: now };
  }

  async findById(id: string): Promise<Feedback | undefined> {
    const row = await queryOne<any>('SELECT * FROM feedbacks WHERE id = ?', [id]);
    return row ? this.mapRow(row) : undefined;
  }

  async findByUserId(userId: string, limit: number = 20): Promise<Feedback[]> {
    const rows = await poolQuery<any>(
      'SELECT * FROM feedbacks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
    return rows.map(this.mapRow);
  }

  async findAll(limit: number = 100): Promise<Feedback[]> {
    const rows = await poolQuery<any>(
      'SELECT * FROM feedbacks ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    return rows.map(this.mapRow);
  }

  async findByStatus(status: string, limit: number = 100): Promise<Feedback[]> {
    const rows = await poolQuery<any>(
      'SELECT * FROM feedbacks WHERE status = ? ORDER BY created_at DESC LIMIT ?',
      [status, limit]
    );
    return rows.map(this.mapRow);
  }

  async updateStatus(id: string, status: 'pending' | 'read' | 'replied'): Promise<void> {
    await execute(
      'UPDATE feedbacks SET status = ?, updated_at = ? WHERE id = ?',
      [status, Date.now(), id]
    );
  }

  async reply(id: string, adminReply: string): Promise<void> {
    await execute(
      'UPDATE feedbacks SET admin_reply = ?, status = \'replied\', updated_at = ? WHERE id = ?',
      [adminReply, Date.now(), id]
    );
  }

  async countByStatus(status: string): Promise<number> {
    const row = await queryOne<any>('SELECT COUNT(*) as c FROM feedbacks WHERE status = ?', [status]);
    return row?.c || 0;
  }

  async countAll(): Promise<number> {
    const row = await queryOne<any>('SELECT COUNT(*) as c FROM feedbacks');
    return row?.c || 0;
  }

  private mapRow(r: any): Feedback {
    return {
      id: r.id,
      userId: r.user_id || '',
      username: r.username || '',
      content: r.content || '',
      contact: r.contact || '',
      status: r.status || 'pending',
      adminReply: r.admin_reply || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}

export const feedbackModel = new FeedbackModel();
