"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationModel = exports.NotificationModel = void 0;
const db_1 = require("./db");
const utils_1 = require("../shared/utils");
class NotificationModel {
    async create(userId, type, title, content, relatedId = '') {
        const id = (0, utils_1.generateUUID)();
        const now = Date.now();
        await (0, db_1.execute)(`INSERT INTO notifications (id, user_id, type, title, content, is_read, related_id, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`, [id, userId, type, title, content, relatedId, now]);
        return { id, userId, type, title, content, isRead: false, relatedId, createdAt: now };
    }
    /** 给所有用户发公告 */
    async createAnnouncement(title, content) {
        const { userModel } = await Promise.resolve().then(() => __importStar(require('./user')));
        const users = await userModel.list();
        let count = 0;
        for (const user of users) {
            await this.create(user.id, 'announcement', title, content);
            count++;
        }
        return count;
    }
    async findByUserId(userId, limit = 50) {
        const rows = await (0, db_1.poolQuery)('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [userId, limit]);
        return rows.map(this.mapRow);
    }
    async countUnread(userId) {
        const row = await (0, db_1.queryOne)('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);
        return row?.c || 0;
    }
    async markRead(id) {
        await (0, db_1.execute)('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    }
    async markAllRead(userId) {
        await (0, db_1.execute)('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);
    }
    mapRow(r) {
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
exports.NotificationModel = NotificationModel;
exports.notificationModel = new NotificationModel();
