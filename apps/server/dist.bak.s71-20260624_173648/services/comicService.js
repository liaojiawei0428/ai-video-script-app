"use strict";
// apps/server/src/services/comicService.ts
// v2.5.20: 漫画生成服务 - JSON 模板架构
// 数据源唯一性: 仅使用 episode.scriptContent 和 episode 的 shots 数组, 禁止硬写入参考内容
// v2.5.20 重构: 使用多风格统一生成 JSON 模板, 每格内容严格独立
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
exports.comicService = exports.ComicService = void 0;
const episode_1 = require("../models/episode");
const novel_1 = require("../models/novel");
const character_1 = require("../models/character");
const shot_1 = require("../models/shot");
const taskJob_1 = require("../models/taskJob");
const billingService_1 = require("./billingService");
const imageProvider_1 = require("./imageProvider");
const websocket_1 = require("./websocket");
const taskQueue_1 = require("./taskQueue");
const utils_1 = require("../shared/utils");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const novelService_1 = require("./novelService");
const comicGeneration_1 = require("../prompts/comicGeneration");
/**
 * v2.5.23: 根据 layout 选择最优 aspect ratio
 * 关键发现: agnes 模型对 aspect ratio 敏感
 *   - portrait (1024x1536) → 自动生成 3x3 网格
 *   - landscape (1536x1024) → 自动生成 3x2 网格
 *   - square (1024x1024) → 自动生成 2x2 网格
 *   - square (2048x2048) → 默认 4x4 (错!)
 * 优先级: 1024 (快) > 2048 (慢但清晰)
 */
function sizeForLayout(layout) {
    switch (layout) {
        case '2x2':
            // 2x2 是对称网格, 方形最自然
            return { width: 1024, height: 1024, sizeStr: '1024x1024', aspect: 'square' };
        case '3x2':
            // 3 列 2 行 = landscape 宽于高
            return { width: 1536, height: 1024, sizeStr: '1536x1024', aspect: 'landscape' };
        case '3x3':
        default:
            // 3 列 3 行 = portrait 高于宽 (关键! 不是 square)
            return { width: 1024, height: 1536, sizeStr: '1024x1536', aspect: 'portrait' };
    }
}
class ComicService {
    /** 入口: 队列任务并立即返回 task */
    // v2.5.27: 新增 useCharacterLibrary 参数 (默认 true), 用户可关闭以跳过角色库注入
    async generateComic(episodeId, useCharacterLibrary = true) {
        const episode = await episode_1.episodeModel.findById(episodeId);
        if (!episode)
            throw new errors_1.AppError('EPISODE_NOT_FOUND', 'Episode not found', 404);
        const shots = await shot_1.shotModel.findByEpisodeId(episodeId);
        if (!shots || shots.length === 0) {
            throw new errors_1.AppError('NO_SHOTS', '请先生成分镜, 再生成漫画', 400);
        }
        // 检查是否已有生成中的任务 (按 episodeId 维度)
        if (taskQueue_1.taskQueue.isQueuedOrRunning(episode.novelId + ':comic')) {
            const existingTaskId = taskQueue_1.taskQueue.getExistingTaskId(episode.novelId + ':comic');
            if (existingTaskId) {
                const existing = await taskJob_1.taskJobModel.findById(existingTaskId);
                if (existing)
                    return existing;
            }
        }
        const task = {
            id: (0, utils_1.generateUUID)(),
            novelId: episode.novelId,
            type: 'comic_generate',
            status: 'queued',
            progress: 0,
            totalSteps: 4,
            currentStep: 0,
            // v2.5.27: 持久化 useCharacterLibrary 标志, 后台执行时读取
            resultData: { useCharacterLibrary, episodeId },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        await taskJob_1.taskJobModel.create(task);
        // 用 novelId:comic 作为 key 避免与分镜/分析任务冲突
        const queueKey = episode.novelId + ':comic';
        taskQueue_1.taskQueue.enqueue(queueKey, '', task.id, () => this.executeComicGeneration(episodeId, task.id));
        return task;
    }
    /** 后台执行漫画生成 */
    async executeComicGeneration(episodeId, taskId) {
        const queueKey = (await episode_1.episodeModel.findById(episodeId))?.novelId + ':comic';
        try {
            const episode = await episode_1.episodeModel.findById(episodeId);
            if (!episode)
                throw new Error('Episode not found');
            const novel = await novel_1.novelModel.findById(episode.novelId);
            const characters = await character_1.characterModel.findByNovelId(episode.novelId);
            const shots = await shot_1.shotModel.findByEpisodeId(episodeId);
            if (!shots || shots.length === 0)
                throw new Error('没有可用的分镜数据');
            // v2.5.27: 读取 useCharacterLibrary 标志 (默认 true, 角色库注入)
            const taskRow = await taskJob_1.taskJobModel.findById(taskId);
            const useCharacterLibrary = taskRow?.resultData?.useCharacterLibrary !== false;
            // 1. 准备阶段
            await taskJob_1.taskJobModel.updateProgress(taskId, 10, 1);
            websocket_1.websocketService.broadcastLlmUpdate(episode.novelId, {
                phase: 'comic_gen', step: 'preparing',
                content: useCharacterLibrary && characters.length > 0
                    ? `🎨 正在准备漫画生成数据 (含 ${characters.length} 个角色视觉 DNA)...`
                    : '🎨 正在准备漫画生成数据...',
                stream: false,
            });
            logger_1.logger.info('Comic generation start', { episodeId, taskId, shotCount: shots.length, useCharacterLibrary, characterCount: characters.length });
            // 2. 计算布局 & 扣费守门
            const layoutInfo = (0, comicGeneration_1.calculateComicLayout)(shots.length);
            await billingService_1.billingService.guardBalance(episode.novelId, taskId, 'comic', 0, layoutInfo.totalPages);
            // 3. 构建分镜输入 (严格只用 shot 字段, 禁止硬写入)
            const comicShots = shots.map(s => ({
                shotNumber: s.shotNumber,
                sceneType: s.sceneType || '',
                cameraMove: s.cameraMove || '',
                visual: extractVisualFromDescription(s.description || ''),
                dialogue: s.dialogue || '',
                lighting: s.lighting || '',
                colorTone: '', // 暂未持久化 colorTone 字段
                audioNote: s.audioNote || '',
                imagePrompt: s.imagePrompt || '',
            }));
            // 4. 角色输入 (v2.5.29: 简化, 收集 referenceSheetUrl + appearanceCount)
            //    - description: 11 维结构化 JSON (降级用)
            //    - visualDna: 从 image_variants[0].prompt 提取的简短身份描述
            //    - hasSheet: 角色是否有三视图
            //    - roleType: 用于 selectMainReferenceCharacter 选主参考图 (主角 > 配角)
            //    - referenceSheetUrl: 角色三视图图 URL, 用于 agnes-image-2.1-flash 多模态生成
            //    - appearanceCount: 角色在本集 shot 描述中出现的次数 (用于主参考图选择)
            //    当 useCharacterLibrary=false 时, 注入空数组 (纯剧本+风格生成)
            //    统计每个角色在 shots 描述中出现的次数
            const allText = comicShots.map(s => `${s.visual} ${s.dialogue}`).join(' ');
            const comicCharacters = useCharacterLibrary
                ? characters.map(c => {
                    const variants = (c.imageVariants || []);
                    const sheetVariant = variants.find(v => v.angle === 'sheet' && (v.url || v.imageData));
                    const sheetUrl = sheetVariant ? (sheetVariant.url || sheetVariant.imageData) : '';
                    // 简单计数: 角色名在所有 shot 文本中出现次数
                    const appearanceCount = (allText.match(new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                    // v2.5.29: 简短身份描述 (200 字符内)
                    const shortId = sheetVariant
                        ? (0, comicGeneration_1.extractShortIdentity)(sheetVariant.prompt || '')
                        : '';
                    return {
                        name: c.name,
                        description: c.description || '',
                        visualDna: shortId,
                        hasSheet: !!sheetVariant,
                        roleType: c.roleType,
                        referenceSheetUrl: sheetUrl,
                        appearanceCount,
                    };
                })
                : [];
            // 5. 风格 (v2.5.20: 从 novel styleBible 自动推断)
            const styleBible = novel?.styleBible;
            const comicStyle = (0, comicGeneration_1.inferComicStyle)(styleBible);
            // 6. 扣费
            await billingService_1.billingService.chargeStep(episode.novelId, 'comic', 0, layoutInfo.totalPages);
            // 7. 分页生成 (v2.5.19 支持多页, v2.5.20 JSON 模板)
            const episodeTitle = episode.title || `第 ${episode.episodeNumber} 集`;
            const episodeScript = episode.scriptContent || '';
            const allPageImages = [];
            for (let page = 1; page <= layoutInfo.totalPages; page++) {
                if (novelService_1.NovelService.isCancelled(queueKey))
                    throw new Error('CANCELLED_BY_USER');
                const startIdx = (page - 1) * layoutInfo.shotsPerPage;
                const endIdx = Math.min(startIdx + layoutInfo.shotsPerPage, shots.length);
                const pageShots = comicShots.slice(startIdx, endIdx);
                await taskJob_1.taskJobModel.updateProgress(taskId, 20 + Math.floor((page - 1) / layoutInfo.totalPages * 60), 2);
                websocket_1.websocketService.broadcastLlmUpdate(episode.novelId, {
                    phase: 'comic_gen', step: 'building_prompt',
                    content: `📝 正在构建第 ${page}/${layoutInfo.totalPages} 页 JSON 提示词 (含 ${pageShots.length} 个分镜, 风格: ${comicStyle})...`,
                    stream: false,
                });
                const layout = layoutInfo.layout;
                const systemPrompt = (0, comicGeneration_1.comicGenerationSystemPrompt)(comicStyle, layout, comicCharacters);
                const userPrompt = (0, comicGeneration_1.comicGenerationUserPrompt)({
                    pageNumber: page,
                    totalPages: layoutInfo.totalPages,
                    episodeTitle,
                    episodeScript,
                    shots: pageShots,
                    characters: comicCharacters,
                    style: comicStyle,
                    layout,
                });
                websocket_1.websocketService.broadcastLlmUpdate(episode.novelId, {
                    phase: 'comic_gen', step: 'generating',
                    content: `🖌️ AI 正在生成第 ${page}/${layoutInfo.totalPages} 页漫画 (${layout} 网格)...`,
                    stream: false,
                });
                try {
                    const startMs = Date.now();
                    // v2.5.23: 按 layout 选择正确 aspect ratio (portrait→3x3, landscape→3x2, square→2x2)
                    const sizeInfo = sizeForLayout(layout);
                    logger_1.logger.info('Comic page using aspect ratio', {
                        episodeId, taskId, page, layout, ...sizeInfo,
                    });
                    // v2.5.29: 选主参考图角色 (出现频次最高的 + 主角)
                    // agnes-image-2.1-flash 单次只接受 1 张 image_url, 我们只传"主参考"
                    const mainRef = (0, comicGeneration_1.selectMainReferenceCharacter)(comicCharacters);
                    const referenceImage = mainRef?.referenceSheetUrl;
                    logger_1.logger.info('Comic reference image selection', {
                        episodeId, taskId, page,
                        mainChar: mainRef?.name,
                        mainCharRole: mainRef?.roleType,
                        mainCharAppearances: mainRef?.appearanceCount,
                        useReference: !!referenceImage,
                        refUrl: referenceImage?.slice(0, 60),
                    });
                    const result = await imageProvider_1.imageProvider.generate({
                        prompt: systemPrompt + '\n\n' + userPrompt,
                        styleId: novel?.styleId,
                        angle: 'comic',
                        width: sizeInfo.width,
                        height: sizeInfo.height,
                        seed: Date.now() + page,
                        referenceImages: referenceImage ? [referenceImage] : undefined,
                    });
                    const durationMs = Date.now() - startMs;
                    allPageImages.push(result.url);
                    logger_1.logger.info('Comic page generated', {
                        episodeId, taskId, page, totalPages: layoutInfo.totalPages,
                        layout, durationMs, imageLen: result.url.length,
                    });
                    websocket_1.websocketService.broadcastLlmUpdate(episode.novelId, {
                        phase: 'comic_gen', step: 'generating',
                        content: `✅ 第 ${page}/${layoutInfo.totalPages} 页完成 (${Math.round(durationMs / 1000)}s)`,
                        stream: false,
                    });
                    // v2.5.19: 每生成一页就立即持久化, 防止后续页失败导致全部丢失
                    const partialUrl = allPageImages.length === 1
                        ? allPageImages[0]
                        : JSON.stringify(allPageImages);
                    await episode_1.episodeModel.update(episodeId, {
                        comicImageUrl: partialUrl,
                        comicGeneratedAt: Date.now(),
                        comicLayout: layoutInfo.layout,
                        comicTotalPages: layoutInfo.totalPages,
                    });
                    logger_1.logger.info('Comic partial saved', {
                        episodeId, taskId, page, totalPages: layoutInfo.totalPages,
                        completedPages: allPageImages.length,
                    });
                }
                catch (pageErr) {
                    const errMsg = pageErr?.message || 'unknown';
                    logger_1.logger.error('Comic page failed', {
                        episodeId, taskId, page, totalPages: layoutInfo.totalPages, error: errMsg,
                    });
                    websocket_1.websocketService.broadcastLlmUpdate(episode.novelId, {
                        phase: 'comic_gen', step: 'error',
                        content: `❌ 第 ${page}/${layoutInfo.totalPages} 页生成失败: ${errMsg} (前 ${allPageImages.length} 页已保存)`,
                        stream: false,
                    });
                    // v2.5.19: 即使后续页失败, 已成功的页仍然保存, 直接跳出循环
                    throw new Error(`第 ${page} 页失败: ${errMsg} (已完成 ${allPageImages.length} 页)`);
                }
            }
            // 8. 保存到 DB
            // v2.5.19 多页用 JSON 数组存储; 单页也兼容
            const comicImageUrl = allPageImages.length === 1
                ? allPageImages[0]
                : JSON.stringify(allPageImages);
            await episode_1.episodeModel.update(episodeId, {
                comicImageUrl,
                comicGeneratedAt: Date.now(),
                comicLayout: layoutInfo.layout,
                comicTotalPages: layoutInfo.totalPages,
            });
            await taskJob_1.taskJobModel.updateProgress(taskId, 100, 4);
            await taskJob_1.taskJobModel.complete(taskId, { totalPages: layoutInfo.totalPages, layout: layoutInfo.layout });
            websocket_1.websocketService.broadcastLlmUpdate(episode.novelId, {
                phase: 'comic_gen', step: 'done',
                content: `🎉 漫画生成完成! 共 ${layoutInfo.totalPages} 页 (${layoutInfo.layout} 布局)`,
                stream: false,
            });
            websocket_1.websocketService.broadcastTaskUpdate(episode.novelId, {
                id: taskId, status: 'completed', progress: 100,
            });
            // 9. 系统通知
            try {
                const { notifySuccess } = await Promise.resolve().then(() => __importStar(require('./notify')));
                const userId = novel?.userId;
                if (userId) {
                    await notifySuccess(userId, '漫画生成完成', `《${novel?.title || '未知小说'}》${episodeTitle} 已生成 ${layoutInfo.totalPages} 页漫画 (${layoutInfo.layout} 布局)。`, episodeId);
                }
            }
            catch (e) {
                logger_1.logger.warn('Comic notify failed', { error: e.message });
            }
            logger_1.logger.info('Comic generation done', {
                episodeId, taskId,
                totalPages: layoutInfo.totalPages, layout: layoutInfo.layout,
                shotCount: shots.length,
            });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            const novelIdForErr = (await episode_1.episodeModel.findById(episodeId))?.novelId || '';
            logger_1.logger.error('Comic generation failed', { episodeId, taskId, error: errorMsg });
            // 广播 llm_update 让 UI 显示错误信息
            websocket_1.websocketService.broadcastLlmUpdate(novelIdForErr, {
                phase: 'comic_gen', step: 'error',
                content: `❌ 漫画生成失败: ${errorMsg}`,
                stream: false,
            });
            await taskJob_1.taskJobModel.fail(taskId, errorMsg);
            // 关键: 广播 task_update (status='failed') 让前端 WS handler 把 comicGenState 设为 'failed'
            // 不然面板会一直显示 "正在生成漫画"
            websocket_1.websocketService.broadcastTaskUpdate(novelIdForErr, {
                id: taskId, status: 'failed', progress: 20,
            });
        }
    }
}
exports.ComicService = ComicService;
/**
 * 从 shot.description 中提取"画面:"之后的内容
 * 若没有"画面:"标签则返回 description 全部
 */
function extractVisualFromDescription(desc) {
    // 匹配"画面[:：]\s*(.*?)" 直到下一个标签或结尾
    const match = desc.match(/画面[:：]\s*([\s\S]+?)(?=\n\s*(?:景别|构图|运镜|对白|灯光|色彩|音效|转场|\[image_prompt\]|---)|$)/);
    if (match)
        return match[1].trim();
    return desc.trim();
}
exports.comicService = new ComicService();
