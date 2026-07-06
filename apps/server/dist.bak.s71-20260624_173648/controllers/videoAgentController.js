"use strict";
// apps/server/src/controllers/videoAgentController.ts
// v3.0.0: 视频 Agent 控制器
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoAgentController = void 0;
const videoAgentService_1 = require("../services/videoAgentService");
const videoConversation_1 = require("../models/videoConversation");
const logger_1 = require("../utils/logger");
exports.videoAgentController = {
    async createConversation(req, res, next) {
        try {
            const userId = req.userId;
            if (!userId)
                return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
            const result = await videoAgentService_1.videoAgentService.createConversation(userId);
            res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
        }
        catch (err) {
            next(err);
        }
    },
    async chat(req, res, next) {
        try {
            const { conversationId, parts, aspectRatio, durationSec } = req.body;
            if (!conversationId)
                return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'conversationId is required' } });
            if (!Array.isArray(parts) || parts.length === 0)
                return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'parts must be non-empty array' } });
            const result = await videoAgentService_1.videoAgentService.processTurn(conversationId, parts, aspectRatio, durationSec);
            res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
        }
        catch (err) {
            next(err);
        }
    },
    async confirm(req, res, next) {
        try {
            const { conversationId } = req.body;
            if (!conversationId)
                return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'conversationId is required' } });
            const result = await videoAgentService_1.videoAgentService.confirm(conversationId);
            res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
        }
        catch (err) {
            next(err);
        }
    },
    async history(req, res, next) {
        try {
            const userId = req.userId;
            if (!userId)
                return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
            const limit = parseInt(req.query.limit) || 50;
            const rows = await videoConversation_1.videoConversationModel.findByUserId(userId, limit);
            res.json({ success: true, data: { conversations: rows }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
        }
        catch (err) {
            next(err);
        }
    },
    async getById(req, res, next) {
        try {
            const conv = await videoConversation_1.videoConversationModel.findById(req.params.id);
            if (!conv)
                return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '会话不存在' } });
            res.json({ success: true, data: { conversation: conv }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
        }
        catch (err) {
            next(err);
        }
    },
    /** v3.0.0.17: DELETE /api/video-agent/conversations/:id - 永久删除 (含 video_generations 审计) */
    async deleteConversation(req, res, next) {
        try {
            const userId = req.userId;
            if (!userId)
                return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
            const conv = await videoConversation_1.videoConversationModel.findById(req.params.id);
            if (!conv)
                return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '会话不存在' } });
            if (conv.user_id !== userId)
                return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '无权删除该会话' } });
            try {
                const mysql = require('../models/db');
                await mysql.execute('DELETE FROM video_generations WHERE conversation_id = ?', [conv.id]);
            }
            catch (err) {
                logger_1.logger.warn('VideoAgent: failed to clean video_generations', { conversationId: conv.id, error: err.message });
            }
            await videoConversation_1.videoConversationModel.delete(conv.id);
            logger_1.logger.info('VideoAgent: conversation deleted', { userId, conversationId: conv.id });
            res.json({ success: true, data: { conversationId: conv.id }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
        }
        catch (err) {
            next(err);
        }
    },
};
