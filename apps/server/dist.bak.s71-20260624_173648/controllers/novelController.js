"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.novelController = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const novelService_1 = require("../services/novelService");
const scriptService_1 = require("../services/scriptService");
const billingService_1 = require("../services/billingService");
const user_1 = require("../models/user");
const novel_1 = require("../models/novel");
const episode_1 = require("../models/episode");
const character_1 = require("../models/character");
const logger_1 = require("../utils/logger");
const maintenance_1 = require("../shared/maintenance");
exports.novelController = {
    async upload(req, res, next) {
        try {
            if ((0, maintenance_1.getMaintenance)()) {
                return res.status(503).json({
                    success: false,
                    error: { code: 'MAINTENANCE', message: '系统维护中，请稍候再试' },
                });
            }
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'No file uploaded',
                    },
                    meta: {
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId,
                    },
                });
            }
            const filePath = req.file.path;
            let title = req.body.title || path_1.default.basename(req.file.originalname, path_1.default.extname(req.file.originalname));
            // 兜底：标题太短或为"by"等无意义值时，用默认标题
            if (!title || title.toLowerCase() === 'by' || title.length < 2) {
                title = `未命名剧本 ${new Date().toLocaleDateString('zh-CN')}`;
            }
            const author = req.body.author || 'Unknown';
            logger_1.logger.info('Uploading novel', { title, author, filePath });
            const userId = req.userId;
            const styleId = req.body.styleId; // v2.0.0
            const novel = await novelService_1.novelService.createNovel(title, author, filePath, userId, styleId);
            // Clean up temp upload file
            try {
                await promises_1.default.unlink(filePath);
            }
            catch {
                logger_1.logger.warn('Failed to clean up temp file', { filePath });
            }
            // Auto-start analysis in background
            let taskId;
            try {
                const task = await novelService_1.novelService.analyzeNovel(novel.id);
                taskId = task.id;
            }
            catch (analysisError) {
                logger_1.logger.warn('Auto-analysis trigger failed', { novelId: novel.id, error: analysisError });
            }
            res.json({
                success: true,
                data: {
                    novelId: novel.id,
                    title: novel.title,
                    totalChars: novel.totalChars,
                    status: novel.status,
                    taskId,
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId,
                },
            });
        }
        catch (error) {
            next(error);
        }
    },
    async analyze(req, res, next) {
        try {
            if ((0, maintenance_1.getMaintenance)()) {
                return res.status(503).json({ success: false, error: { code: 'MAINTENANCE', message: '系统维护中，请稍候再试' } });
            }
            const { novelId } = req.params;
            logger_1.logger.info('Starting analysis', { novelId });
            const task = await novelService_1.novelService.analyzeNovel(novelId);
            res.json({
                success: true,
                data: {
                    taskId: task.id,
                    status: task.status,
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId,
                },
            });
        }
        catch (error) {
            next(error);
        }
    },
    // v2.5.10: 从已有 analysis_report 回填角色 (不重跑 LLM)
    async backfillCharacters(req, res, next) {
        try {
            const { novelId } = req.params;
            const userId = req.userId;
            if (!novelId) {
                return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: '缺少 novelId' } });
            }
            const novel = await novel_1.novelModel.findById(novelId);
            if (!novel) {
                return res.status(404).json({ success: false, error: { code: 'NOVEL_NOT_FOUND', message: '小说不存在' } });
            }
            if (userId && novel.userId && novel.userId !== userId) {
                return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '无权操作此小说' } });
            }
            const result = await novelService_1.novelService.backfillCharactersFromReport(novelId);
            logger_1.logger.info('backfillCharacters completed', { novelId, userId, ...result });
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
    async getAnalysis(req, res, next) {
        try {
            const { novelId } = req.params;
            const novel = await novelService_1.novelService.getNovel(novelId);
            if (!novel) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'NOVEL_NOT_FOUND',
                        message: 'Novel not found',
                    },
                    meta: {
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId,
                    },
                });
            }
            const characters = await character_1.characterModel.findByNovelId(novelId);
            res.json({
                success: true,
                data: {
                    genre: novel.genre,
                    theme: novel.theme,
                    style: novel.style,
                    tone: novel.tone,
                    characters,
                    scenes: novel.scenes || [],
                    plotPoints: novel.plotPoints || [],
                    analysisReport: novel.analysisReport || '',
                    fullSummary: novel.fullSummary || '',
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId,
                },
            });
        }
        catch (error) {
            next(error);
        }
    },
    async getEpisodes(req, res, next) {
        try {
            const { novelId } = req.params;
            const light = req.query.light !== 'false';
            const episodes = light
                ? await episode_1.episodeModel.findByNovelIdLight(novelId)
                : await episode_1.episodeModel.findByNovelId(novelId);
            res.json({
                success: true,
                data: { episodes },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId,
                },
            });
        }
        catch (error) {
            next(error);
        }
    },
    async generateEpisodes(req, res, next) {
        try {
            if ((0, maintenance_1.getMaintenance)()) {
                return res.status(503).json({ success: false, error: { code: 'MAINTENANCE', message: '系统维护中，请稍候再试' } });
            }
            const { novelId } = req.params;
            const { targetDuration = 120, tolerance = 10, continue: continueFlag } = req.body;
            logger_1.logger.info('Starting episode generation', { novelId, targetDuration, tolerance, continueFlag });
            const task = continueFlag
                ? await scriptService_1.scriptService.continueEpisodeGeneration(novelId, targetDuration)
                : await scriptService_1.scriptService.generateEpisodes(novelId, targetDuration, tolerance);
            res.json({
                success: true,
                data: {
                    taskId: task.id,
                    status: task.status,
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId,
                },
            });
        }
        catch (error) {
            next(error);
        }
    },
    async regenerateEpisode(req, res, next) {
        try {
            const { episodeId } = req.params;
            logger_1.logger.info('Starting episode regeneration', { episodeId });
            const task = await scriptService_1.scriptService.regenerateEpisode(episodeId);
            res.json({
                success: true,
                data: {
                    taskId: task.id,
                    status: task.status,
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId,
                },
            });
        }
        catch (error) {
            next(error);
        }
    },
    async exportNovel(req, res, next) {
        try {
            const { novelId } = req.params;
            const { format = 'json' } = req.query;
            const episodes = await episode_1.episodeModel.findByNovelId(novelId);
            if (format === 'json') {
                res.json({
                    success: true,
                    data: { episodes },
                    meta: {
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId,
                    },
                });
            }
            else if (format === 'txt') {
                const txt = episodes.map((ep) => {
                    return `=== 第${ep.episodeNumber}集：${ep.title || ''} ===
时长：${ep.durationSec}秒
摘要：${ep.summary || ''}

${ep.scriptContent || ''}`;
                }).join('\n\n\n');
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="script-${novelId}.txt"`);
                res.send(txt);
            }
            else {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Unsupported format',
                    },
                    meta: {
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId,
                    },
                });
            }
        }
        catch (error) {
            next(error);
        }
    },
    async estimateFee(req, res, next) {
        try {
            const userId = req.userId;
            const wordCount = parseInt(req.query.wordCount) || 0;
            const charCount = parseInt(req.query.charCount) || wordCount;
            const novelId = req.query.novelId || '';
            const estEpisodes = Math.max(1, Math.ceil((charCount || wordCount) / (1050 * 3.5)));
            let result;
            if (novelId) {
                result = await billingService_1.billingService.estimate(novelId, wordCount, estEpisodes);
            }
            else {
                // 从当前登录用户获取余额和VIP状态
                const user = userId ? await user_1.userModel.findById(userId) : null;
                const vip = user?.vipLevel && user.vipLevel >= 1;
                const unitPrice = vip ? 0.01 : 0.012;
                const analyzeFee = Math.max(0.01, Math.round(wordCount * unitPrice / 1000 * 100) / 100);
                result = { analyzeFee, shotFee: 0, total: analyzeFee, balance: user?.balance || 0, isVip: !!vip };
            }
            res.json({
                success: true,
                data: {
                    ...result,
                    amount: result.total,
                    unitPrice: result.isVip ? 0.01 : 0.012,
                    sufficient: (result.balance || 0) >= result.total,
                },
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        catch (error) {
            next(error);
        }
    },
    async list(req, res, next) {
        try {
            const userId = req.userId;
            const q = req.query.q || undefined; // v2.0.0
            const status = req.query.status || undefined; // v2.0.0
            const novels = userId
                ? await novel_1.novelModel.findByUserId(userId, { q, status })
                : await novelService_1.novelService.listNovels();
            res.json({
                success: true,
                data: { novels },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId,
                },
            });
        }
        catch (error) {
            next(error);
        }
    },
    // v2.0.1 补: 获取单本小说详情
    async getNovel(req, res, next) {
        try {
            const { novelId } = req.params;
            const userId = req.userId;
            const novel = await novelService_1.novelService.getNovel(novelId);
            if (!novel) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOVEL_NOT_FOUND', message: '小说不存在' },
                    meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
                });
            }
            // 越权保护: 只能看自己的小说 (v2.0)
            if (userId && novel.userId && novel.userId !== userId) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权访问此小说' },
                    meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
                });
            }
            res.json({
                success: true,
                data: novel,
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        catch (error) {
            next(error);
        }
    },
    async remove(req, res, next) {
        try {
            const { novelId } = req.params;
            await novelService_1.novelService.deleteNovel(novelId);
            res.json({
                success: true,
                data: { deleted: true },
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        catch (error) {
            next(error);
        }
    },
    async updateNovel(req, res, next) {
        try {
            const { novelId } = req.params;
            const { genre, theme, style, tone } = req.body;
            await novel_1.novelModel.updateAnalysis(novelId, { genre, theme, style, tone });
            res.json({
                success: true,
                data: { updated: true },
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        catch (error) {
            next(error);
        }
    },
    async updateCharacter(req, res, next) {
        try {
            const { characterId } = req.params;
            const { name, appearance, personality, roleType } = req.body;
            await character_1.characterModel.update(characterId, { name, appearance, personality, roleType });
            res.json({
                success: true,
                data: { updated: true },
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        catch (error) {
            next(error);
        }
    },
    // v2.5.11: 全字段更新 (含 description/extraDescription JSON)
    async updateCharacterFull(req, res, next) {
        try {
            const { characterId } = req.params;
            const userId = req.userId;
            const { name, aliases, appearance, personality, roleType, description, extraDescription } = req.body;
            // 越权校验: 通过 character → novel 链路确认所有权
            const char = await character_1.characterModel.findById(characterId);
            if (!char) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'CHARACTER_NOT_FOUND', message: '角色不存在' },
                });
            }
            if (char.novelId) {
                const novel = await novel_1.novelModel.findById(char.novelId);
                if (novel?.userId && userId && novel.userId !== userId) {
                    return res.status(403).json({
                        success: false,
                        error: { code: 'FORBIDDEN', message: '无权编辑此角色' },
                    });
                }
            }
            // v2.5.34: aliases 数组, description/extraDescription 字符串
            await character_1.characterModel.updateFull(characterId, { name, aliases, appearance, personality, roleType, description, extraDescription });
            logger_1.logger.info('Character full update', { characterId, userId, hasDesc: !!description, descLen: typeof description === 'string' ? description.length : 0 });
            res.json({
                success: true,
                data: { updated: true },
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        catch (error) {
            next(error);
        }
    },
    // v2.5.11: 编辑小说元信息 (genre/theme/style/tone)
    async updateNovelMeta(req, res, next) {
        try {
            const { novelId } = req.params;
            const userId = req.userId;
            const novel = await novel_1.novelModel.findById(novelId);
            if (!novel) {
                return res.status(404).json({ success: false, error: { code: 'NOVEL_NOT_FOUND', message: '小说不存在' } });
            }
            if (userId && novel.userId && novel.userId !== userId) {
                return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '无权操作此小说' } });
            }
            const { genre, theme, style, tone } = req.body;
            await novel_1.novelModel.updateAnalysis(novelId, { genre, theme, style, tone });
            logger_1.logger.info('Novel meta update', { novelId, userId });
            res.json({
                success: true,
                data: { updated: true },
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        catch (error) {
            next(error);
        }
    },
    // v2.5.11: 编辑完整 analysis_report
    async updateAnalysisReport(req, res, next) {
        try {
            const { novelId } = req.params;
            const userId = req.userId;
            const novel = await novel_1.novelModel.findById(novelId);
            if (!novel) {
                return res.status(404).json({ success: false, error: { code: 'NOVEL_NOT_FOUND', message: '小说不存在' } });
            }
            if (userId && novel.userId && novel.userId !== userId) {
                return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '无权操作此小说' } });
            }
            const { analysisReport } = req.body;
            if (typeof analysisReport !== 'string') {
                return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'analysisReport 必须是字符串' } });
            }
            await novel_1.novelModel.updateAnalysisReport(novelId, analysisReport);
            logger_1.logger.info('Analysis report update', { novelId, userId, length: analysisReport.length });
            res.json({
                success: true,
                data: { updated: true },
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        catch (error) {
            next(error);
        }
    },
};
