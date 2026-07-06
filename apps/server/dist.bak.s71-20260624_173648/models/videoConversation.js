"use strict";
// apps/server/src/models/videoConversation.ts
// v3.0.0: 视频 Agent 会话 model (video_conversations + video_generations)
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoGenerationModel = exports.videoConversationModel = exports.VideoGenerationModel = exports.VideoConversationModel = void 0;
const db_1 = require("./db");
const utils_1 = require("../shared/utils");
class VideoConversationModel {
    async create(opts) {
        const id = (0, utils_1.generateUUID)();
        const now = Date.now();
        await (0, db_1.execute)(`INSERT INTO video_conversations (id, user_id, status, mode, messages, plan, duration_sec, resolution, fps, retry_count, charged_amount, created_at, updated_at)
       VALUES (?, ?, 'idle', ?, '[]', null, 5, '1152x768', 24, 0, 0, ?, ?)`, [id, opts.userId, opts.mode || 'text2vid', now, now]);
        return id;
    }
    async findById(id) {
        return (0, db_1.queryOne)('SELECT * FROM video_conversations WHERE id = ?', [id]);
    }
    async findByUserId(userId, limit = 50) {
        return (0, db_1.queryAll)('SELECT * FROM video_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?', [userId, limit]);
    }
    async update(id, data) {
        const sets = [];
        const params = [];
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined)
                continue;
            const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            if ((col === 'messages' || col === 'plan' || col === 'ref_image_urls') && typeof value !== 'string') {
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
        await (0, db_1.execute)(`UPDATE video_conversations SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    async delete(id) {
        await (0, db_1.execute)('DELETE FROM video_conversations WHERE id = ?', [id]);
    }
}
exports.VideoConversationModel = VideoConversationModel;
class VideoGenerationModel {
    async create(opts) {
        const id = (0, utils_1.generateUUID)();
        await (0, db_1.execute)(`INSERT INTO video_generations (id, conversation_id, prompt, ref_image_urls, status, duration_sec, resolution, charged_amount, created_at)
       VALUES (?, ?, ?, ?, 'queued', ?, ?, 0, ?)`, [id, opts.conversationId, opts.prompt, JSON.stringify(opts.refImageUrls || []), opts.durationSec || 5, opts.resolution || '1152x768', Date.now()]);
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
        await (0, db_1.execute)(`UPDATE video_generations SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    async findById(id) {
        return (0, db_1.queryOne)('SELECT * FROM video_generations WHERE id = ?', [id]);
    }
}
exports.VideoGenerationModel = VideoGenerationModel;
exports.videoConversationModel = new VideoConversationModel();
exports.videoGenerationModel = new VideoGenerationModel();
