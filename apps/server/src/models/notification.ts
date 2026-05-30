import { queryOne, queryAll, execute, poolQuery } from './db';
import { generateUUID } from '../shared/utils';

export interface Notification {
  id: string;
  userId: string;
  type: 'feedback_reply' | 'announcement' | 'system';
  title: string;
  content: string;
  isRead: boolean;
  relatedId: string;
  createdAt: number;
}

export class NotificationModel {
  async create(userId: string, type: Notification['type'], title: string, content: string, relatedId: string = ''): Promise<Notification> {
    const id = generateUUID();
    const now = Date.now();
    await execute(
      `INSERT INTO notifications (id, user_id, type, title, content, is_read, related_id, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [id, userId, type, title, content, relatedId, now]
    );
    return { id, userId, type, title, content, isRead: false, relatedId, createdAt: now };
  }

  /** 给所有用户发公告 */
  async createAnnouncement(title: string, content: string): Promise<number> {
    const { userModel } = await import('./user');
    const users = await userModel.list();
    let count = 0;
    for (const user of users) {
      await this.create(user.id, 'announcement', title, content);
      count++;
    }
    return count;
  }

  async findByUserId(userId: string, limit: number = 50): Promise<Notification[]> {
    const rows = await poolQuery<any>(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
    return rows.map(this.mapRow);
  }

  async countUnread(userId: string): Promise<number> {
    const row = await queryOne<any>(
      'SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return row?.c || 0;
  }

  async markRead(id: string): Promise<void> {
    await execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
  }

  async markAllRead(userId: string): Promise<void> {
    await execute('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);
  }

  private mapRow(r: any): Notification {
    return {
      id: r.id,
      userId: r.user_id,
      type: r.type || 'system',
      title: r.title || '',
      content: r.content || '',
      isRead: !!r.is_read,
      relatedId: r.related_id || '',
      createdAt: r.created_at,
    };
  }
}

export const notificationModel = new NotificationModel();
