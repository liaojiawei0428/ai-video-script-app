"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userModel = exports.UserModel = void 0;
const db_1 = require("./db");
class UserModel {
    async create(user) {
        await (0, db_1.execute)(`INSERT INTO users (id, username, email, password_hash, nickname, avatar_url,
       balance, total_generations, last_ip, ip_location, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [user.id, user.username, user.email || null, user.passwordHash,
            user.nickname, user.avatarUrl, user.balance, user.totalGenerations,
            user.lastIp || '', user.ipLocation || '', user.createdAt, user.updatedAt]);
    }
    async findById(id) {
        const row = await (0, db_1.queryOne)('SELECT * FROM users WHERE id = ?', [id]);
        if (!row)
            return undefined;
        return this.mapRow(row);
    }
    async findByUsername(username) {
        const row = await (0, db_1.queryOne)('SELECT * FROM users WHERE username = ?', [username]);
        if (!row)
            return undefined;
        return this.mapRow(row);
    }
    async findByEmail(email) {
        const row = await (0, db_1.queryOne)('SELECT * FROM users WHERE email = ?', [email]);
        if (!row)
            return undefined;
        return this.mapRow(row);
    }
    async updateProfile(id, data) {
        const sets = [];
        const params = [];
        if (data.nickname !== undefined) {
            sets.push('nickname = ?');
            params.push(data.nickname);
        }
        if (data.avatarUrl !== undefined) {
            sets.push('avatar_url = ?');
            params.push(data.avatarUrl);
        }
        if (sets.length === 0)
            return;
        sets.push('updated_at = ?');
        params.push(Date.now(), id);
        await (0, db_1.execute)(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    async updatePassword(id, passwordHash) {
        await (0, db_1.execute)('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [passwordHash, Date.now(), id]);
    }
    async updateBalance(id, amount) {
        await (0, db_1.execute)('UPDATE users SET balance = balance + ?, updated_at = ? WHERE id = ?', [amount, Date.now(), id]);
    }
    async updateVipLevel(id, level) {
        await (0, db_1.execute)('UPDATE users SET vip_level = ?, updated_at = ? WHERE id = ?', [level, Date.now(), id]);
    }
    async updateVip(id, level, expiresAt) {
        await (0, db_1.execute)('UPDATE users SET vip_level = ?, vip_expires_at = ?, updated_at = ? WHERE id = ?', [level, expiresAt, Date.now(), id]);
    }
    async clearVip(id) {
        await (0, db_1.execute)('UPDATE users SET vip_level = 0, vip_expires_at = NULL, updated_at = ? WHERE id = ?', [Date.now(), id]);
    }
    async setRole(id, role) {
        await (0, db_1.execute)('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, Date.now(), id]);
    }
    async countAll() {
        const row = await (0, db_1.queryOne)('SELECT COUNT(*) as c FROM users');
        return row?.c || 0;
    }
    async countToday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const row = await (0, db_1.queryOne)('SELECT COUNT(*) as c FROM users WHERE created_at >= ?', [today.getTime()]);
        return row?.c || 0;
    }
    async incrementGenerations(id) {
        await (0, db_1.execute)('UPDATE users SET total_generations = total_generations + 1, updated_at = ? WHERE id = ?', [Date.now(), id]);
    }
    async countByIp(ip) {
        if (!ip)
            return 0;
        const row = await (0, db_1.queryOne)('SELECT COUNT(*) as c FROM users WHERE last_ip = ?', [ip]);
        return row?.c || 0;
    }
    async list() {
        const rows = await (0, db_1.queryAll)('SELECT * FROM users ORDER BY created_at DESC');
        return rows.map(row => this.mapRow(row));
    }
    async updateIp(id, ip) {
        await (0, db_1.execute)('UPDATE users SET last_ip = ?, updated_at = ? WHERE id = ?', [ip, Date.now(), id]);
    }
    async updateIpLocation(id, ip, location) {
        await (0, db_1.execute)('UPDATE users SET last_ip = ?, ip_location = ?, updated_at = ? WHERE id = ?', [ip, location, Date.now(), id]);
    }
    /** 管理员用户列表（含统计） */
    async listDetail() {
        const rows = await (0, db_1.queryAll)(`
      SELECT u.*,
        COALESCE(nc.cnt, 0) as novel_count,
        COALESCE(rc.total, 0) as total_recharge,
        COALESCE(cc.total, 0) as total_consumption
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) as cnt FROM novels WHERE user_id IS NOT NULL AND user_id != '' GROUP BY user_id
      ) nc ON nc.user_id = u.id
      LEFT JOIN (
        SELECT user_id, ROUND(SUM(amount), 2) as total
        FROM billing_logs WHERE type = 'charge' AND user_id != '' GROUP BY user_id
      ) rc ON rc.user_id = u.id
      LEFT JOIN (
        SELECT user_id, ROUND(SUM(amount), 2) as total
        FROM billing_logs WHERE type = 'consumption' AND user_id != '' GROUP BY user_id
      ) cc ON cc.user_id = u.id
      ORDER BY u.created_at DESC
    `);
        return rows.map(row => ({
            id: row.id,
            username: row.username,
            nickname: row.nickname || '',
            balance: parseFloat(row.balance || '0'),
            totalGenerations: row.total_generations || 0,
            totalRecharge: parseFloat(row.total_recharge || '0'),
            totalConsumption: parseFloat(row.total_consumption || '0'),
            novelCount: row.novel_count || 0,
            vipLevel: row.vip_level || 0,
            lastIp: row.last_ip || '',
            ipLocation: row.ip_location || '',
            createdAt: row.created_at,
        }));
    }
    mapRow(row) {
        return {
            id: row.id,
            username: row.username,
            email: row.email || undefined,
            passwordHash: row.password_hash,
            nickname: row.nickname || '',
            avatarUrl: row.avatar_url || '',
            balance: parseFloat(row.balance || '0'),
            totalGenerations: row.total_generations || 0,
            vipLevel: row.vip_level || 0,
            vipExpiresAt: row.vip_expires_at || undefined,
            lastIp: row.last_ip || '',
            ipLocation: row.ip_location || '',
            role: row.role || 'user',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
exports.UserModel = UserModel;
exports.userModel = new UserModel();
