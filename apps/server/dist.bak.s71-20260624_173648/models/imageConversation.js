"use strict";
// apps/server/src/models/imageConversation.ts
// v3.0.0: 生图 Agent 会话 model (image_conversations + image_generations)
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageGenerationModel = exports.imageConversationModel = exports.ImageGenerationModel = exports.ImageConversationModel = void 0;
const db_1 = require("./db");
const utils_1 = require("../shared/utils");
class ImageConversationModel {
    async create(opts) {
        const id = (0, utils_1.generateUUID)();
        const now = Date.now();
        await (0, db_1.execute)(`INSERT INTO image_conversations (id, user_id, status, mode, messages, plan, charged_amount, retry_count, created_at, updated_at)
       VALUES (?, ?, 'idle', ?, '[]', null, 0, 0, ?, ?)`, [id, opts.userId, opts.mode || 'text2img', now, now]);
        return id;
    }
    async findById(id) {
        return (0, db_1.queryOne)('SELECT * FROM image_conversations WHERE id = ?', [id]);
    }
    async findByUserId(userId, limit = 50) {
        return (0, db_1.queryAll)('SELECT * FROM image_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?', [userId, limit]);
    }
    async update(id, data) {
        const sets = [];
        const params = [];
        const jsonFields = { messages: 'messages', plan: 'plan', ref_image_urls: 'ref_image_urls', plan_fields: 'plan_fields' };
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined)
                continue;
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
            }
            else {
                sets.push(`${col} = ?`);
                params.push(value);
            }
        }
        if (sets.length === 0)
            return;
        sets.push('updated_at = ?');
        params.push(Date.now());
        params.push(id);
        await (0, db_1.execute)(`UPDATE image_conversations SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    async delete(id) {
        await (0, db_1.execute)('DELETE FROM image_conversations WHERE id = ?', [id]);
    }
}
exports.ImageConversationModel = ImageConversationModel;
class ImageGenerationModel {
    async create(opts) {
        const id = (0, utils_1.generateUUID)();
        await (0, db_1.execute)(`INSERT INTO image_generations (id, conversation_id, prompt, ref_image_urls, status, charged_amount, created_at)
       VALUES (?, ?, ?, ?, 'queued', 0, ?)`, [id, opts.conversationId, opts.prompt, JSON.stringify(opts.refImageUrls || []), Date.now()]);
        return id;
    }
    async update(id, data) {
        const sets = [];
        const params = [];
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined)
                continue;
            const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            if (col === 'ref_image_urls' && typeof value !== 'string') {
                sets.push(`${col} = ?`);
                params.push(JSON.stringify(value));
            }
            else {
                sets.push(`${col} = ?`);
                params.push(value);
            }
        }
        if (sets.length === 0)
            return;
        params.push(id);
        await (0, db_1.execute)(`UPDATE image_generations SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    async findById(id) {
        return (0, db_1.queryOne)('SELECT * FROM image_generations WHERE id = ?', [id]);
    }
    async findByConversationId(conversationId) {
        return (0, db_1.queryAll)('SELECT * FROM image_generations WHERE conversation_id = ? ORDER BY created_at DESC', [conversationId]);
    }
}
exports.ImageGenerationModel = ImageGenerationModel;
exports.imageConversationModel = new ImageConversationModel();
exports.imageGenerationModel = new ImageGenerationModel();
