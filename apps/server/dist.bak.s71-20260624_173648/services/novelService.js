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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.novelService = exports.NovelService = void 0;
const novel_1 = require("../models/novel");
const character_1 = require("../models/character");
const taskJob_1 = require("../models/taskJob");
const user_1 = require("../models/user");
const billingService_1 = require("./billingService");
const deepseekPool_1 = require("./deepseekPool");
const fileParser_1 = require("./fileParser");
const websocket_1 = require("./websocket");
const chunkService_1 = require("./chunkService");
const taskQueue_1 = require("./taskQueue");
const novelAnalysis_1 = require("../prompts/novelAnalysis");
const styleBible_1 = require("../services/styleBible");
const utils_1 = require("../shared/utils");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const iconv_lite_1 = __importDefault(require("iconv-lite"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
class NovelService {
    static cancelledNovels = new Set();
    static markCancelled(novelId) {
        NovelService.cancelledNovels.add(novelId);
    }
    static isCancelled(novelId) {
        return NovelService.cancelledNovels.has(novelId);
    }
    static clearCancelled(novelId) {
        NovelService.cancelledNovels.delete(novelId);
    }
    /**
     * v2.5.10 公开：从 analysis_report 文本中解析角色列表
     * 兼容 4 种区段头: "🎭 角色分析：" / "🎭 分析：" / "角色分析：" / "分析："
     * 兼容 LLM 偶尔漏冒号: "外貌 " / "性格 " / "类型 "
     */
    /**
     * v2.5.14: 从分析报告中解析角色详细描述 (37 字段格式)
     * 返回值包含完整的 description JSON, 不再只是 appearance/personality 简单字段
     */
    static parseCharactersFromReport(fullContent) {
        let roleSection = fullContent.match(/🎭[^\n]*?角色分析[：:]([\s\S]*?)(?=📜|$)/);
        if (!roleSection)
            roleSection = fullContent.match(/🎭[^\n]*?分析[：:]([\s\S]*?)(?=📜|$)/);
        if (!roleSection)
            roleSection = fullContent.match(/角色分析[：:]([\s\S]*?)(?=\n\n|\n📜|$)/);
        if (!roleSection)
            roleSection = fullContent.match(/^分析[：:]\s*([\s\S]*?)(?=\n\n|\n📜|$)/m);
        const parsedChars = [];
        if (!roleSection)
            return parsedChars;
        // 字段映射: 中文标签 → JSON key
        const fieldMap = {
            '类型': 'role_type', '性别': 'gender', '年龄': 'age', '身高': 'height',
            '体型': 'build', '脸型': 'face', '肤色': 'skin',
            '眼睛': 'eyes', '眉毛': 'eyebrows', '鼻子': 'nose', '嘴唇': 'lips',
            '发色': 'hair_color', '发型': 'hair_style', '发长': 'hair_length', '发饰': 'hair_accessories',
            '上衣': 'clothing_top', '下装': 'clothing_bottom', '外套': 'clothing_outer', '鞋子': 'clothing_shoes',
            '颈饰': 'accessories_neck', '耳饰': 'accessories_ears', '手饰': 'accessories_hands',
            '腰饰': 'accessories_waist', '其他配饰': 'accessories_other',
            '随身道具': 'props', '显著特征': 'distinctive_features', '妆容': 'makeup',
            '默认表情': 'default_expression', '情绪范围': 'emotional_range', '肢体语言': 'body_language',
            '性格视觉化': 'personality_visual', '阶层视觉化': 'social_class_visual',
            '外貌': '_appearance', '性格': '_personality', '关系': '_relationships',
        };
        const lines = roleSection[1].split('\n');
        let currentChar = null;
        for (const line of lines) {
            // 角色名行: "1. 名字 - 身份" / "1、 名字 -"
            const nameMatch = line.match(/^\s*\d+[.、\.]\s*([^\s\-–—(（]+)/);
            if (nameMatch) {
                if (currentChar)
                    parsedChars.push(currentChar);
                const name = nameMatch[1].replace(/[）)]$/, '').trim();
                currentChar = {
                    name, appearance: '', personality: '', roleType: 'supporting',
                    description: { name },
                };
            }
            else if (currentChar) {
                // 解析每个字段: "   字段名：值"
                for (const [label, key] of Object.entries(fieldMap)) {
                    const regex = new RegExp(`^\\s*${label}\\s*[：:]?\\s*(.+)`);
                    const match = line.match(regex);
                    if (match) {
                        const value = match[1].trim();
                        if (key === '_appearance') {
                            currentChar.appearance = value;
                        }
                        else if (key === '_personality') {
                            currentChar.personality = value;
                        }
                        else if (key === 'role_type') {
                            currentChar.roleType = value.includes('主角') ? 'protagonist' :
                                value.includes('反派') ? 'antagonist' :
                                    value.includes('龙套') ? 'minor' : 'supporting';
                            currentChar.description.role_type = currentChar.roleType;
                        }
                        else {
                            currentChar.description[key] = value;
                        }
                        break;
                    }
                }
            }
        }
        if (currentChar)
            parsedChars.push(currentChar);
        return parsedChars;
    }
    /**
     * v2.5.10: 回填 - 从已有 analysis_report 重新解析并创建角色（不重跑 LLM）
     * 用于修复历史 novel（如 33ca8e0a）的角色库为空问题
     */
    async backfillCharactersFromReport(novelId) {
        const novel = await novel_1.novelModel.findById(novelId);
        if (!novel)
            throw new errors_1.AppError('NOVEL_NOT_FOUND', `Novel ${novelId} not found`, 404);
        const report = novel.analysisReport || '';
        if (!report)
            throw new errors_1.AppError('NO_ANALYSIS', '小说没有 analysis_report，无法回填', 400);
        const parsedChars = NovelService.parseCharactersFromReport(report);
        if (parsedChars.length === 0) {
            logger_1.logger.warn('backfillCharactersFromReport: 仍未解析到角色', { novelId });
            return { created: 0, total: 0, alreadyExisted: 0, descriptionsGenerated: 0 };
        }
        // 查现有角色，避免重复
        const existing = await character_1.characterModel.findByNovelId(novelId);
        const existingNames = new Set(existing.map(c => c.name));
        const toCreate = parsedChars.filter(c => !existingNames.has(c.name));
        let created = 0;
        if (toCreate.length > 0) {
            const characters = toCreate.map(char => ({
                id: (0, utils_1.generateUUID)(), novelId,
                name: char.name, aliases: [],
                appearance: char.appearance, personality: char.personality,
                roleType: char.roleType, relationships: [],
                createdAt: Date.now(),
            }));
            await character_1.characterModel.bulkCreate(characters);
            created = characters.length;
            logger_1.logger.info('backfillCharactersFromReport: created', { novelId, created });
        }
        // v2.5.14: 同步调用 extractDescriptions, 从小说原文生成详细描述
        // 之前是 setImmediate 异步, 用户看不到结果
        let descriptionsGenerated = 0;
        try {
            websocket_1.websocketService.broadcastProgress(novelId, 0, 'character_extracting');
            const { extractDescriptions } = await Promise.resolve().then(() => __importStar(require('./characterService')));
            const descResult = await extractDescriptions(novelId);
            descriptionsGenerated = descResult.succeeded;
            logger_1.logger.info('backfillCharactersFromReport: descriptions generated', { novelId, ...descResult });
        }
        catch (err) {
            logger_1.logger.warn('backfill extractDescriptions failed', { novelId, error: err instanceof Error ? err.message : String(err) });
        }
        return { created, total: parsedChars.length, alreadyExisted: existing.length, descriptionsGenerated };
    }
    async createNovel(title, author, filePath, userId, styleId) {
        const { content, title: parsedTitle } = await fileParser_1.fileParserService.parseFile(filePath);
        const novelDir = path_1.default.join(config_1.config.uploadDir, 'novels');
        await promises_1.default.mkdir(novelDir, { recursive: true });
        const novelFilePath = path_1.default.join(novelDir, `${(0, utils_1.generateUUID)()}.txt`);
        await promises_1.default.writeFile(novelFilePath, content, 'utf-8');
        // v2.5.9: 生成 styleBible（风格圣经）——全剧所有生成的不可变风格锚点
        const styleBible = (0, styleBible_1.buildStyleBible)((styleId || 'realistic'));
        const novel = {
            id: (0, utils_1.generateUUID)(),
            title: title || parsedTitle,
            author,
            userId,
            filePath: novelFilePath,
            totalChars: content.length,
            totalWords: content.split(/\s+/).length,
            genre: '',
            theme: '',
            style: '',
            tone: '',
            // v2.0.0
            styleId: styleId || 'realistic',
            // v2.5.9: 风格圣经（自动生成，所有生成流必须引用）
            styleBible: styleBible,
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        await novel_1.novelModel.create(novel);
        logger_1.logger.info('Novel created', {
            novelId: novel.id, title: novel.title, totalChars: novel.totalChars,
            styleId: novel.styleId, styleBibleVersion: styleBible.version,
        });
        return novel;
    }
    async analyzeNovel(novelId) {
        const novel = await novel_1.novelModel.findById(novelId);
        if (!novel)
            throw new errors_1.AppError('NOVEL_NOT_FOUND', `Novel ${novelId} not found`, 404);
        if (!novel.filePath)
            throw new errors_1.AppError('VALIDATION_ERROR', 'Novel file not available', 400);
        if (taskQueue_1.taskQueue.isQueuedOrRunning(novelId)) {
            const existingTaskId = taskQueue_1.taskQueue.getExistingTaskId(novelId);
            if (existingTaskId) {
                const existing = await taskJob_1.taskJobModel.findById(existingTaskId);
                if (existing)
                    return existing;
            }
        }
        const raw = await promises_1.default.readFile(novel.filePath);
        let content = iconv_lite_1.default.decode(raw, 'utf-8');
        if (content.includes('\uFFFD'))
            content = iconv_lite_1.default.decode(raw, 'gbk');
        const task = {
            id: (0, utils_1.generateUUID)(),
            novelId,
            type: 'analyze',
            status: 'queued',
            progress: 0,
            totalSteps: 3,
            currentStep: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        await taskJob_1.taskJobModel.create(task);
        await novel_1.novelModel.updateStatus(novelId, 'analyzing');
        taskQueue_1.taskQueue.enqueue(novelId, novel.userId || '', task.id, () => this.executeAnalysis(novelId, content, task.id));
        return task;
    }
    async executeAnalysis(novelId, content, taskId) {
        try {
            logger_1.logger.info('Starting novel analysis with chunk pipeline', { novelId, taskId, totalChars: content.length });
            // 余额守门检查
            await billingService_1.billingService.guardBalance(novelId, taskId, 'analyze', content.length);
            await billingService_1.billingService.chargeStep(novelId, 'analyze', content.length);
            // ========== Phase 0-2: 分块管道（非流式，显示进度） ==========
            websocket_1.websocketService.broadcastLlmUpdate(novelId, {
                phase: 'analyzing', step: 'reasoning',
                content: '📄 正在分割小说...（全文约 ' + (content.length / 10000).toFixed(1) + '万字）',
            });
            await taskJob_1.taskJobModel.updateProgress(taskId, 3, 1);
            websocket_1.websocketService.broadcastProgress(novelId, 3, 'analyzing');
            // Phase 0: 分块
            const chunks = chunkService_1.chunkService.splitIntoChunks(content);
            if (chunks.length === 1) {
                // 小说很短（<=80K），直接走原有流式分析
                logger_1.logger.info('Novel fits in single chunk, using direct analysis', { novelId, chars: content.length });
                websocket_1.websocketService.broadcastLlmUpdate(novelId, {
                    phase: 'analyzing', step: 'reasoning',
                    content: '📖 小说字数在单次处理范围内，直接分析...',
                });
                await taskJob_1.taskJobModel.updateProgress(taskId, 5, 1);
                websocket_1.websocketService.broadcastProgress(novelId, 5, 'analyzing');
                await this.streamAnalysis(novelId, content, taskId);
                return;
            }
            // 多块处理：逐块分析
            websocket_1.websocketService.broadcastLlmUpdate(novelId, {
                phase: 'analyzing', step: 'reasoning',
                content: `📚 小说需要分 ${chunks.length} 段处理（每段约 ${Math.round(content.length / chunks.length / 1000)}K 字）`,
            });
            // Phase 1: 逐块分析
            logger_1.logger.info('Starting chunk analysis', { novelId, chunkCount: chunks.length });
            const novelForStyle = await novel_1.novelModel.findById(novelId);
            const styleBibleBlock = novelForStyle?.styleBible ? (0, styleBible_1.buildStyleAnchorPrefix)(novelForStyle.styleBible, 'zh') : undefined;
            const summaries = await chunkService_1.chunkService.analyzeAllChunks(chunks, novelId, (progress) => {
                websocket_1.websocketService.broadcastChunkProgress(novelId, progress);
            }, styleBibleBlock);
            const failedCount = summaries.filter(s => s.failed).length;
            if (failedCount > 0) {
                logger_1.logger.warn('Some chunks failed', { novelId, failedCount, total: chunks.length });
                websocket_1.websocketService.broadcastLlmUpdate(novelId, {
                    phase: 'analyzing', step: 'reasoning',
                    content: `⚠️ 有 ${failedCount} 段分析失败（已跳过，不影响整体结果）`,
                });
            }
            // 进度 75%
            await taskJob_1.taskJobModel.updateProgress(taskId, 75, 2);
            websocket_1.websocketService.broadcastProgress(novelId, 75, 'analyzing');
            // Phase 2: 一次性合并
            websocket_1.websocketService.broadcastLlmUpdate(novelId, {
                phase: 'analyzing', step: 'reasoning',
                content: '🔗 正在合并所有段落分析结果...',
            });
            const fullSummary = await chunkService_1.chunkService.mergeSummaries(summaries, novelId, styleBibleBlock);
            logger_1.logger.info('Full summary generated', { novelId, summaryLength: fullSummary.length });
            // 保存全文摘要到数据库
            await novel_1.novelModel.updateFullSummary(novelId, fullSummary);
            // 进度 85% — 准备最终分析
            await taskJob_1.taskJobModel.updateProgress(taskId, 85, 2);
            websocket_1.websocketService.broadcastProgress(novelId, 85, 'analyzing');
            // ========== Phase 3: 流式输出最终分析结果 ==========
            websocket_1.websocketService.broadcastLlmUpdate(novelId, {
                phase: 'analyzing', step: 'reasoning',
                content: '📖 正在基于全文摘要生成分析报告...',
            });
            let fullContent = '';
            const novelRecord = await novel_1.novelModel.findById(novelId);
            const styleBibleJson = novelRecord?.styleBible ? (0, styleBible_1.buildStyleBibleJsonBlock)(novelRecord.styleBible) : undefined;
            await deepseekPool_1.deepseekPool.chatCompletionStreamWithRetry(novelAnalysis_1.novelAnalysisSystemPrompt, (0, novelAnalysis_1.novelAnalysisUserPrompt)(fullSummary, styleBibleJson), (chunk) => {
                if (NovelService.isCancelled(novelId)) {
                    throw new Error('CANCELLED_BY_USER');
                }
                fullContent += chunk;
                websocket_1.websocketService.broadcastLlmUpdate(novelId, {
                    phase: 'analyzing', step: 'reasoning',
                    content: chunk,
                    tokens: fullContent.length,
                    stream: true,
                });
            }, 0.3);
            // 流式已逐字推送完成
            websocket_1.websocketService.broadcastLlmUpdate(novelId, {
                phase: 'analyzing', step: 'output',
                content: '✅ 小说分析完成',
                tokens: fullContent.length,
            });
            // 解析结构化数据并保存
            await this.parseAndSave(novelId, fullContent, taskId);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error('Novel analysis failed', { novelId, taskId, error: errorMsg });
            websocket_1.websocketService.broadcastProgress(novelId, 0, 'error');
            await taskJob_1.taskJobModel.fail(taskId, errorMsg);
            await novel_1.novelModel.updateStatus(novelId, 'error');
            // v2.5.15: 创建系统通知
            try {
                const novel = await novel_1.novelModel.findById(novelId);
                if (novel?.userId) {
                    const { notifyError } = await Promise.resolve().then(() => __importStar(require('./notify')));
                    await notifyError(novel.userId, '小说分析失败', `《${novel.title || '未知小说'}》分析失败：${errorMsg.slice(0, 200)}\n请重试或联系客服。`, novelId);
                }
            }
            catch { }
        }
    }
    /**
     * 短篇小说（<=80K）直接流式分析，不走分块管道
     */
    async streamAnalysis(novelId, content, taskId) {
        await taskJob_1.taskJobModel.updateProgress(taskId, 10, 1);
        websocket_1.websocketService.broadcastProgress(novelId, 10, 'analyzing');
        let fullContent = '';
        await deepseekPool_1.deepseekPool.chatCompletionStreamWithRetry(novelAnalysis_1.novelAnalysisSystemPrompt, (0, novelAnalysis_1.novelAnalysisUserPrompt)(content), (chunk) => {
            if (NovelService.isCancelled(novelId)) {
                throw new Error('CANCELLED_BY_USER');
            }
            fullContent += chunk;
            websocket_1.websocketService.broadcastLlmUpdate(novelId, {
                phase: 'analyzing', step: 'reasoning',
                content: chunk,
                tokens: fullContent.length,
                stream: true,
            });
        }, 0.3);
        websocket_1.websocketService.broadcastLlmUpdate(novelId, {
            phase: 'analyzing', step: 'output',
            content: '✅ 小说分析完成',
            tokens: fullContent.length,
        });
        // 后续结构化解析与 executeAnalysis 相同，复用 parseAndSave 方法
        await this.parseAndSave(novelId, fullContent, taskId);
    }
    /**
     * 解析 AI 分析结果并保存到数据库
     */
    async parseAndSave(novelId, fullContent, taskId) {
        await taskJob_1.taskJobModel.updateProgress(taskId, 60, 2);
        websocket_1.websocketService.broadcastProgress(novelId, 60, 'analyzing');
        const extractLine = (emojiPrefix, textPrefix) => {
            let re = new RegExp(`${emojiPrefix}[：:](.+)`);
            let m = fullContent.match(re);
            if (m)
                return m[1].trim();
            re = new RegExp(`^${textPrefix}[：:](.+)`, 'm');
            m = fullContent.match(re);
            if (m)
                return m[1].trim();
            return '';
        };
        const genre = extractLine('📖 类型', '类型').slice(0, 200);
        const theme = extractLine('📌 主题', '主题').slice(0, 500);
        const style = extractLine('🎨 风格', '风格').slice(0, 500);
        const tone = extractLine('💭 基调', '基调').slice(0, 500);
        const parsedChars = NovelService.parseCharactersFromReport(fullContent);
        const saveGenre = genre && genre !== 'unknown' && genre !== '未分类' ? genre : '未分类';
        await novel_1.novelModel.updateAnalysis(novelId, {
            genre: saveGenre, theme, style, tone,
            scenes: [], plotPoints: [],
        });
        // 保存完整分析报告文本
        await novel_1.novelModel.updateAnalysisReport(novelId, fullContent);
        logger_1.logger.info('Analysis report saved', { novelId, reportLength: fullContent.length });
        if (parsedChars.length > 0) {
            const characters = parsedChars.map(char => ({
                id: (0, utils_1.generateUUID)(), novelId,
                name: char.name, aliases: [],
                appearance: char.appearance, personality: char.personality,
                roleType: char.roleType,
                relationships: [],
                description: JSON.stringify(char.description), // v2.5.14: 保存完整 37 字段描述 JSON
                createdAt: Date.now(),
            }));
            await character_1.characterModel.bulkCreate(characters);
            logger_1.logger.info('Characters saved', { novelId, count: characters.length, descFields: Object.keys(characters[0]?.description ? JSON.parse(characters[0].description) : {}).length });
        }
        else {
            logger_1.logger.warn('No characters parsed from analysis report (regex missed)', { novelId, contentLength: fullContent.length });
        }
        // ========== Phase 4: 角色描述补充 (v2.5.14 — 仅当分析报告未生成详细描述时才调用) ==========
        // 新版分析 prompt 已在报告中生成 37 字段详细描述, 不需要再单独调 extractDescriptions
        // 但旧版报告(简单格式)没有详细描述, 需要补充
        const needsDescExtraction = parsedChars.some(c => !c.description || Object.keys(c.description).length <= 2);
        if (needsDescExtraction) {
            await taskJob_1.taskJobModel.updateProgress(taskId, 90, 3);
            websocket_1.websocketService.broadcastProgress(novelId, 90, 'analyzing');
            websocket_1.websocketService.broadcastLlmUpdate(novelId, {
                phase: 'analyzing', step: 'reasoning',
                content: '🎭 正在根据小说原文补充角色详细描述...',
            });
            try {
                const { extractDescriptions } = await Promise.resolve().then(() => __importStar(require('./characterService')));
                const descResult = await extractDescriptions(novelId);
                for (const char of descResult.characters) {
                    if (char.description) {
                        websocket_1.websocketService.broadcastLlmUpdate(novelId, {
                            phase: 'character_extracting', step: 'output',
                            content: `✅ ${char.name}: 描述已生成`,
                            stream: false,
                        });
                    }
                }
                websocket_1.websocketService.broadcastLlmUpdate(novelId, {
                    phase: 'character_extracting', step: 'output',
                    content: `🎭 角色描述补充完成: ${descResult.succeeded}/${descResult.total} 个角色`,
                    stream: false,
                });
                logger_1.logger.info('Character descriptions supplemented', { novelId, ...descResult });
            }
            catch (err) {
                logger_1.logger.warn('Character description supplementation failed', { novelId, error: err instanceof Error ? err.message : String(err) });
            }
        }
        else {
            logger_1.logger.info('Characters already have detailed descriptions from analysis, skipping extractDescriptions', { novelId });
            websocket_1.websocketService.broadcastLlmUpdate(novelId, {
                phase: 'character_extracting', step: 'output',
                content: `🎭 角色详细描述已从分析报告中提取 (${parsedChars.length} 个角色)`,
                stream: false,
            });
        }
        await taskJob_1.taskJobModel.updateProgress(taskId, 100, 3);
        websocket_1.websocketService.broadcastProgress(novelId, 100, 'analyzed');
        await taskJob_1.taskJobModel.complete(taskId, { genre: saveGenre, theme, style, tone, characterCount: parsedChars.length });
        await novel_1.novelModel.updateStatus(novelId, 'analyzed');
        try {
            const novel = await novel_1.novelModel.findById(novelId);
            if (novel?.userId)
                await user_1.userModel.incrementGenerations(novel.userId);
        }
        catch { }
        logger_1.logger.info('Novel analysis completed', { novelId, taskId });
        // v2.5.36 GAP-1 修复: 自动生成 outline + plotGraph, 失败不阻塞剧集生成
        // 后续可在 OutlinePage / PlotGraphPage 查看/编辑/确认
        // 注: 当前不强制 outline_confirmed 检查 (切集算法两套并存, 留 v2.0.1 统一)
        try {
            const { outlineService } = await Promise.resolve().then(() => __importStar(require('./outlineService')));
            websocket_1.websocketService.broadcastLlmUpdate(novelId, {
                phase: 'outline_generating', step: 'reasoning',
                content: '📋 正在生成分集大纲...', stream: false,
            });
            const outline = await outlineService.generateOutline(novelId);
            logger_1.logger.info('Auto-generated outline', { novelId, itemCount: outline.items.length });
            websocket_1.websocketService.broadcastLlmUpdate(novelId, {
                phase: 'outline_generating', step: 'output',
                content: `✅ 分集大纲已生成 (${outline.items.length} 集), 可在 OutlinePage 查看/编辑/确认`,
                stream: false,
            });
            websocket_1.websocketService.broadcastLlmUpdate(novelId, {
                phase: 'plot_graph_generating', step: 'reasoning',
                content: '📊 正在生成章节事件图谱...', stream: false,
            });
            const plotGraph = await outlineService.generatePlotGraph(novelId);
            logger_1.logger.info('Auto-generated plotGraph', { novelId, chapterCount: plotGraph.chapters.length });
            websocket_1.websocketService.broadcastLlmUpdate(novelId, {
                phase: 'plot_graph_generating', step: 'output',
                content: `✅ 章节事件图谱已生成 (${plotGraph.chapters.length} 章), 可在 PlotGraphPage 查看`,
                stream: false,
            });
        }
        catch (err) {
            logger_1.logger.warn('Auto-generate outline/plotGraph failed (not blocking)', {
                novelId, error: err instanceof Error ? err.message : String(err),
            });
        }
        // 分析完成后自动进入剧集生成 (沿用原切集算法, 后续 v2.0.1 统一集数计算)
        try {
            const scriptService = (await Promise.resolve().then(() => __importStar(require('./scriptService')))).scriptService;
            await scriptService.generateEpisodes(novelId);
            logger_1.logger.info('Auto-triggered episode generation after analysis', { novelId });
        }
        catch (err) {
            logger_1.logger.warn('Failed to auto-trigger episode generation', { novelId, error: err instanceof Error ? err.message : String(err) });
        }
    }
    async getNovel(novelId) {
        return novel_1.novelModel.findById(novelId);
    }
    async listNovels() {
        return novel_1.novelModel.list();
    }
    async deleteNovel(novelId) {
        const novel = await novel_1.novelModel.findById(novelId);
        if (!novel)
            throw new errors_1.AppError('NOVEL_NOT_FOUND', `Novel ${novelId} not found`, 404);
        // 1. 标记取消，让正在运行的后台任务停止 AI 调用（不清除标记，保持永久取消状态）
        NovelService.markCancelled(novelId);
        taskQueue_1.taskQueue.cancel(novelId);
        // 2. 通知客户端任务已终止
        websocket_1.websocketService.broadcastProgress(novelId, 0, 'error', { detail: '小说已被删除，任务已终止' });
        try {
            // 3. 取消所有正在运行的 task_job
            const { execute, queryAll } = await Promise.resolve().then(() => __importStar(require('../models/db')));
            const runningTasks = await queryAll("SELECT id FROM task_jobs WHERE novel_id = ? AND status IN ('running','queued')", [novelId]);
            for (const t of runningTasks) {
                await taskJob_1.taskJobModel.cancel(t.id);
            }
            // 4. 删除上传文件
            if (novel.filePath) {
                try {
                    await promises_1.default.unlink(novel.filePath);
                }
                catch {
                    logger_1.logger.warn('Failed to delete novel file', { filePath: novel.filePath });
                }
            }
            // 5. 级联删除数据库记录
            await execute('DELETE FROM shots WHERE episode_id IN (SELECT id FROM episodes WHERE novel_id = ?)', [novelId]);
            await execute('DELETE FROM episodes WHERE novel_id = ?', [novelId]);
            await execute('DELETE FROM characters WHERE novel_id = ?', [novelId]);
            await execute('DELETE FROM task_jobs WHERE novel_id = ?', [novelId]);
            await execute('DELETE FROM novels WHERE id = ?', [novelId]);
            logger_1.logger.info('Novel deleted with cascade', { novelId });
        }
        catch (err) {
            // 删除失败时才清除取消标记
            NovelService.clearCancelled(novelId);
            throw err;
        }
    }
}
exports.NovelService = NovelService;
exports.novelService = new NovelService();
