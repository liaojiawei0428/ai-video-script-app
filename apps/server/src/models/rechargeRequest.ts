import { queryOne, execute, poolQuery } from './db';
import { generateUUID } from '../shared/utils';

export interface RechargeRow {
  id: string; userId: string; username: string; amount: number;
  status: string; remark: string; ip: string; ipLocation: string;
  // v3.0.37 (S72 batch 7 BUG-092): 用户点"我已付款"时间戳, admin 看板优先处理
  userNotifiedAt: number;
  createdAt: number; updatedAt: number;
}

export class RechargeRequestModel {
  async create(userId: string, username: string, amount: number, ip: string, ipLocation: string): Promise<RechargeRow> {
    const id = generateUUID();
    const now = Date.now();
    await execute(
      `INSERT INTO recharge_requests (id, user_id, username, amount, status, ip, ip_location, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [id, userId, username, amount, ip, ipLocation, now, now]
    );
    return { id, userId, username, amount, status: 'pending', remark: '', ip, ipLocation, userNotifiedAt: 0, createdAt: now, updatedAt: now };
  }

  async findById(id: string): Promise<RechargeRow | undefined> {
    const rows = await poolQuery<any>(
      'SELECT * FROM recharge_requests WHERE id = ?', [id]
    );
    return rows[0] ? this.mapRow(rows[0]) : undefined;
  }

  async updateStatus(id: string, status: 'approved' | 'rejected', remark: string = ''): Promise<void> {
    await execute(
      'UPDATE recharge_requests SET status = ?, remark = ?, updated_at = ? WHERE id = ?',
      [status, remark, Date.now()]
    );
  }

  // v3.0.37 (S72 batch 7 BUG-092): 标记用户已通知已付款 (admin 看板可优先处理)
  async markUserNotified(id: string): Promise<void> {
    await execute(
      'UPDATE recharge_requests SET user_notified_at = ?, updated_at = ? WHERE id = ?',
      [Date.now(), Date.now(), id]
    );
  }

  async findByStatus(status: string, limit: number = 100): Promise<RechargeRow[]> {
    const rows = await poolQuery<any>(
      'SELECT * FROM recharge_requests WHERE status = ? ORDER BY created_at DESC LIMIT ?',
      [status, limit]
    );
    return rows.map(this.mapRow);
  }

  async findByUserId(userId: string, limit: number = 20): Promise<RechargeRow[]> {
    const rows = await poolQuery<any>(
      'SELECT * FROM recharge_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
    return rows.map(this.mapRow);
  }

  async findAll(limit: number = 200): Promise<RechargeRow[]> {
    const rows = await poolQuery<any>(
      'SELECT * FROM recharge_requests ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    return rows.map(this.mapRow);
  }

  async countByStatus(status: string): Promise<number> {
    const row = await queryOne<any>(
      'SELECT COUNT(*) as c FROM recharge_requests WHERE status = ?',
      [status]
    );
    return row?.c || 0;
  }

  async countToday(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const row = await queryOne<any>(
      'SELECT COUNT(*) as c FROM recharge_requests WHERE created_at >= ?',
      [today.getTime()]
    );
    return row?.c || 0;
  }

  private mapRow(r: any): RechargeRow {
    return {
      id: r.id, userId: r.user_id, username: r.username || '',
      amount: parseFloat(r.amount), status: r.status, remark: r.remark || '',
      ip: r.ip || '', ipLocation: r.ip_location || '',
      // v3.0.37 (S72 batch 7 BUG-092): 兼容老库字段可能为 undefined
      userNotifiedAt: r.user_notified_at ? parseInt(r.user_notified_at) : 0,
      createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }
}

export const rechargeRequestModel = new RechargeRequestModel();
