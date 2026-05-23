import { queryOne, queryAll, execute } from './db';
import { User } from '../shared/types';

export class UserModel {
  async create(user: User): Promise<void> {
    await execute(
      `INSERT INTO users (id, username, email, password_hash, nickname, avatar_url,
       balance, total_generations, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.username, user.email || null, user.passwordHash,
       user.nickname, user.avatarUrl, user.balance, user.totalGenerations,
       user.createdAt, user.updatedAt]
    );
  }

  async findById(id: string): Promise<User | undefined> {
    const row = await queryOne<any>('SELECT * FROM users WHERE id = ?', [id]);
    if (!row) return undefined;
    return this.mapRow(row);
  }

  async findByUsername(username: string): Promise<User | undefined> {
    const row = await queryOne<any>('SELECT * FROM users WHERE username = ?', [username]);
    if (!row) return undefined;
    return this.mapRow(row);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const row = await queryOne<any>('SELECT * FROM users WHERE email = ?', [email]);
    if (!row) return undefined;
    return this.mapRow(row);
  }

  async updateProfile(id: string, data: { nickname?: string; avatarUrl?: string }): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [];
    if (data.nickname !== undefined) { sets.push('nickname = ?'); params.push(data.nickname); }
    if (data.avatarUrl !== undefined) { sets.push('avatar_url = ?'); params.push(data.avatarUrl); }
    if (sets.length === 0) return;
    sets.push('updated_at = ?');
    params.push(Date.now(), id);
    await execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await execute('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
      [passwordHash, Date.now(), id]);
  }

  async updateBalance(id: string, amount: number): Promise<void> {
    await execute('UPDATE users SET balance = balance + ?, updated_at = ? WHERE id = ?',
      [amount, Date.now(), id]);
  }

  async incrementGenerations(id: string): Promise<void> {
    await execute('UPDATE users SET total_generations = total_generations + 1, updated_at = ? WHERE id = ?',
      [Date.now(), id]);
  }

  async list(): Promise<User[]> {
    const rows = await queryAll<any>('SELECT * FROM users ORDER BY created_at DESC');
    return rows.map(row => this.mapRow(row));
  }

  private mapRow(row: any): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email || undefined,
      passwordHash: row.password_hash,
      nickname: row.nickname || '',
      avatarUrl: row.avatar_url || '',
      balance: parseFloat(row.balance || '0'),
      totalGenerations: row.total_generations || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const userModel = new UserModel();
