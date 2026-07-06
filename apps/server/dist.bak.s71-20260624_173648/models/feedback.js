"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedbackModel = exports.FeedbackModel = void 0;
const db_1 = require("./db");
const utils_1 = require("../shared/utils");
class FeedbackModel {
    async create(userId, username, content, contact) {
        const id = (0, utils_1.generateUUID)();
        const now = Date.now();
        await (0, db_1.execute)(`INSERT INTO feedbacks (id, user_id, username, content, contact, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`, [id, userId, username, content, contact, now, now]);
        return { id, userId, username, content, contact, status: 'pending', adminReply: '', createdAt: now, updatedAt: now };
    }
    async findById(id) {
        const row = await (0, db_1.queryOne)('SELECT * FROM feedbacks WHERE id = ?', [id]);
        return row ? this.mapRow(row) : undefined;
    }
    async findByUserId(userId, limit = 20) {
        const rows = await (0, db_1.poolQuery)('SELECT * FROM feedbacks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [userId, limit]);
        return rows.map(this.mapRow);
    }
    async findAll(limit = 100) {
        const rows = await (0, db_1.poolQuery)('SELECT * FROM feedbacks ORDER BY created_at DESC LIMIT ?', [limit]);
        return rows.map(this.mapRow);
    }
    async findByStatus(status, limit = 100) {
        const rows = await (0, db_1.poolQuery)('SELECT * FROM feedbacks WHERE status = ? ORDER BY created_at DESC LIMIT ?', [status, limit]);
        return rows.map(this.mapRow);
    }
    async updateStatus(id, status) {
        await (0, db_1.execute)('UPDATE feedbacks SET status = ?, updated_at = ? WHERE id = ?', [status, Date.now(), id]);
    }
    async reply(id, adminReply) {
        await (0, db_1.execute)('UPDATE feedbacks SET admin_reply = ?, status = \'replied\', updated_at = ? WHERE id = ?', [adminReply, Date.now(), id]);
    }
    async countByStatus(status) {
        const row = await (0, db_1.queryOne)('SELECT COUNT(*) as c FROM feedbacks WHERE status = ?', [status]);
        return row?.c || 0;
    }
    async countAll() {
        const row = await (0, db_1.queryOne)('SELECT COUNT(*) as c FROM feedbacks');
        return row?.c || 0;
    }
    mapRow(r) {
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
exports.FeedbackModel = FeedbackModel;
exports.feedbackModel = new FeedbackModel();
