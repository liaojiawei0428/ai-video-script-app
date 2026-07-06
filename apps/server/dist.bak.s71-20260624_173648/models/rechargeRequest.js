"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rechargeRequestModel = exports.RechargeRequestModel = void 0;
const db_1 = require("./db");
const utils_1 = require("../shared/utils");
class RechargeRequestModel {
    async create(userId, username, amount, ip, ipLocation) {
        const id = (0, utils_1.generateUUID)();
        const now = Date.now();
        await (0, db_1.execute)(`INSERT INTO recharge_requests (id, user_id, username, amount, status, ip, ip_location, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`, [id, userId, username, amount, ip, ipLocation, now, now]);
        return { id, userId, username, amount, status: 'pending', remark: '', ip, ipLocation, createdAt: now, updatedAt: now };
    }
    async findById(id) {
        const rows = await (0, db_1.poolQuery)('SELECT * FROM recharge_requests WHERE id = ?', [id]);
        return rows[0] ? this.mapRow(rows[0]) : undefined;
    }
    async updateStatus(id, status, remark = '') {
        await (0, db_1.execute)('UPDATE recharge_requests SET status = ?, remark = ?, updated_at = ? WHERE id = ?', [status, remark, Date.now(), id]);
    }
    async findByStatus(status, limit = 100) {
        const rows = await (0, db_1.poolQuery)('SELECT * FROM recharge_requests WHERE status = ? ORDER BY created_at DESC LIMIT ?', [status, limit]);
        return rows.map(this.mapRow);
    }
    async findByUserId(userId, limit = 20) {
        const rows = await (0, db_1.poolQuery)('SELECT * FROM recharge_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [userId, limit]);
        return rows.map(this.mapRow);
    }
    async findAll(limit = 200) {
        const rows = await (0, db_1.poolQuery)('SELECT * FROM recharge_requests ORDER BY created_at DESC LIMIT ?', [limit]);
        return rows.map(this.mapRow);
    }
    async countByStatus(status) {
        const row = await (0, db_1.queryOne)('SELECT COUNT(*) as c FROM recharge_requests WHERE status = ?', [status]);
        return row?.c || 0;
    }
    async countToday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const row = await (0, db_1.queryOne)('SELECT COUNT(*) as c FROM recharge_requests WHERE created_at >= ?', [today.getTime()]);
        return row?.c || 0;
    }
    mapRow(r) {
        return {
            id: r.id, userId: r.user_id, username: r.username || '',
            amount: parseFloat(r.amount), status: r.status, remark: r.remark || '',
            ip: r.ip || '', ipLocation: r.ip_location || '',
            createdAt: r.created_at, updatedAt: r.updated_at,
        };
    }
}
exports.RechargeRequestModel = RechargeRequestModel;
exports.rechargeRequestModel = new RechargeRequestModel();
