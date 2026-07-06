"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.episodeController = void 0;
const scriptService_1 = require("../services/scriptService");
const episode_1 = require("../models/episode");
const shot_1 = require("../models/shot");
const novel_1 = require("../models/novel");
const exportService_1 = require("../services/exportService");
const comicService_1 = require("../services/comicService");
const logger_1 = require("../utils/logger");
exports.episodeController = {
    async getEpisode(req, res, next) {
        try {
            const { episodeId } = req.params;
            const episode = await episode_1.episodeModel.findById(episodeId);
            if (!episode) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Episode not found' },
                    meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
                });
            }
            res.json({ success: true, data: { episode }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
        }
        catch (error) {
            next(error);
        }
    },
    async getShots(req, res, next) {
        try {
            const { episodeId } = req.params;
            const shots = await shot_1.shotModel.findByEpisodeId(episodeId);
            res.json({ success: true, data: { shots }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
        }
        catch (error) {
            next(error);
        }
    },
    async generateShots(req, res, next) {
        try {
            const { episodeId } = req.params;
            logger_1.logger.info('Starting shot generation', { episodeId });
            const task = await scriptService_1.scriptService.generateShots(episodeId);
            res.json({ success: true, data: { taskId: task.id, status: task.status }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
        }
        catch (error) {
            next(error);
        }
    },
    // v2.5.12: 编辑剧集 (含完整越权校验)
    async updateEpisode(req, res, next) {
        try {
            const { episodeId } = req.params;
            const userId = req.userId;
            const ep = await episode_1.episodeModel.findById(episodeId);
            if (!ep)
                return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '剧集不存在' } });
            if (ep.novelId) {
                const novel = await novel_1.novelModel.findById(ep.novelId);
                if (novel?.userId && userId && novel.userId !== userId) {
                    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '无权编辑此剧集' } });
                }
            }
            const updates = req.body;
            await episode_1.episodeModel.update(episodeId, updates);
            logger_1.logger.info('Episode update', { episodeId, userId, fields: Object.keys(updates) });
            res.json({ success: true, data: { updated: true }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
        }
        catch (error) {
            next(error);
        }
    },
    // v2.5.12: 编辑镜头 (含完整越权校验)
    async updateShot(req, res, next) {
        try {
            const { shotId } = req.params;
            const userId = req.userId;
            const shot = await shot_1.shotModel.findById(shotId);
            if (!shot)
                return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '镜头不存在' } });
            if (shot.episodeId) {
                const ep = await episode_1.episodeModel.findById(shot.episodeId);
                if (ep?.novelId) {
                    const novel = await novel_1.novelModel.findById(ep.novelId);
                    if (novel?.userId && userId && novel.userId !== userId) {
                        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '无权编辑此镜头' } });
                    }
                }
            }
            const updates = req.body;
            await shot_1.shotModel.update(shotId, updates);
            logger_1.logger.info('Shot update', { shotId, userId, fields: Object.keys(updates) });
            res.json({ success: true, data: { updated: true }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
        }
        catch (error) {
            next(error);
        }
    },
    async exportEpisode(req, res, next) {
        try {
            const { episodeId } = req.params;
            const format = (req.query.format === 'docx' ? 'docx' : 'pdf');
            const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
            const host = req.headers.host || 'localhost';
            const baseUrl = `${proto}://${host}`;
            const result = await exportService_1.exportService.exportEpisode(episodeId, format, baseUrl);
            res.json({
                success: true,
                data: result,
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        catch (error) {
            next(error);
        }
    },
    // ──────────────────────────────────────────────────
    // v2.5.19: 漫画生成
    // ──────────────────────────────────────────────────
    async generateComic(req, res, next) {
        try {
            const { episodeId } = req.params;
            // v2.5.27: 用户可选择是否使用角色库 (默认 true)
            // false 时: 纯剧本+风格生成, 不注入角色视觉 DNA
            const useCharacterLibrary = req.body?.useCharacterLibrary !== false;
            logger_1.logger.info('Starting comic generation', { episodeId, useCharacterLibrary });
            const task = await comicService_1.comicService.generateComic(episodeId, useCharacterLibrary);
            res.json({
                success: true,
                data: { taskId: task.id, status: task.status, useCharacterLibrary },
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        catch (error) {
            next(error);
        }
    },
    async getComic(req, res, next) {
        try {
            const { episodeId } = req.params;
            const episode = await episode_1.episodeModel.findById(episodeId);
            if (!episode) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Episode not found' },
                    meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
                });
            }
            const rawUrl = episode.comicImageUrl;
            // 兼容多页 (JSON 数组) 和单页
            let images = [];
            if (rawUrl) {
                if (rawUrl.startsWith('[')) {
                    try {
                        images = JSON.parse(rawUrl);
                    }
                    catch {
                        images = [rawUrl];
                    }
                }
                else {
                    images = [rawUrl];
                }
            }
            res.json({
                success: true,
                data: {
                    images,
                    layout: episode.comicLayout || null,
                    totalPages: episode.comicTotalPages || (images.length || 0),
                    generatedAt: episode.comicGeneratedAt || null,
                },
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        catch (error) {
            next(error);
        }
    },
};
