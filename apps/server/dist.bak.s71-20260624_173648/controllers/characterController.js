"use strict";
// 角色一致性 v2.0 Controller
// 三阶段流程: 描述提取 → 用户确认 → 多角度变体图
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
exports.characterController = void 0;
const characterService_1 = require("../services/characterService");
const logger_1 = require("../utils/logger");
const maintenance_1 = require("../shared/maintenance");
function success(res, data) {
    res.json({
        success: true,
        data,
        meta: {
            timestamp: new Date().toISOString(),
            requestId: res.req.requestId,
        },
    });
}
function fail(res, status, code, message) {
    res.status(status).json({
        success: false,
        error: { code, message },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: res.req.requestId,
        },
    });
}
exports.characterController = {
    /**
     * POST /api/novels/:novelId/characters/extract
     * 触发角色描述生成（异步执行, 完成后通过 WS 推送）
     */
    async extract(req, res, next) {
        try {
            if ((0, maintenance_1.getMaintenance)())
                return fail(res, 503, 'MAINTENANCE', '系统维护中');
            const novelId = req.params.novelId;
            const userId = req.userId;
            if (!novelId || !userId)
                return fail(res, 400, 'BAD_REQUEST', '缺少 novelId 或 userId');
            // 立即返回 202, 实际提取在后台进行
            res.status(202).json({
                success: true,
                data: { message: '角色描述生成已启动, 完成后将通过 WebSocket 通知', novelId },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId,
                },
            });
            // 后台执行
            setImmediate(async () => {
                try {
                    const result = await (0, characterService_1.extractDescriptions)(novelId);
                    logger_1.logger.info('Character extract completed', { novelId, ...result });
                }
                catch (err) {
                    logger_1.logger.error('Character extract failed', { novelId, error: err });
                }
            });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * GET /api/novels/:novelId/characters
     * 列出小说所有角色
     */
    async listByNovel(req, res, next) {
        try {
            const novelId = req.params.novelId;
            if (!novelId)
                return fail(res, 400, 'BAD_REQUEST', '缺少 novelId');
            const characters = await (0, characterService_1.listCharactersByNovel)(novelId);
            return success(res, { characters, total: characters.length });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * GET /api/characters/:characterId
     * 查单个角色详情
     */
    async getOne(req, res, next) {
        try {
            const characterId = req.params.characterId;
            if (!characterId)
                return fail(res, 400, 'BAD_REQUEST', '缺少 characterId');
            const character = await (0, characterService_1.findCharacterById)(characterId);
            if (!character)
                return fail(res, 404, 'NOT_FOUND', '角色不存在');
            return success(res, character);
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * POST /api/characters/:characterId/confirm
     * 用户确认角色描述（只更新确认状态，不覆盖描述数据）
     */
    async confirm(req, res, next) {
        try {
            if ((0, maintenance_1.getMaintenance)())
                return fail(res, 503, 'MAINTENANCE', '系统维护中');
            const characterId = req.params.characterId;
            if (!characterId)
                return fail(res, 400, 'BAD_REQUEST', '缺少 characterId');
            const result = await (0, characterService_1.confirmDescription)(characterId, { description: {}, extraDescription: {} });
            return success(res, result);
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * POST /api/characters/:characterId/generate-images
     * 生成 3 张变体图（按张扣费）
     * Body: { onlyAngles?: ['front_bust', 'side_bust', 'full_body'] }
     */
    async generateImages(req, res, next) {
        try {
            if ((0, maintenance_1.getMaintenance)())
                return fail(res, 503, 'MAINTENANCE', '系统维护中');
            const characterId = req.params.characterId;
            const userId = req.userId;
            if (!characterId || !userId)
                return fail(res, 400, 'BAD_REQUEST', '缺少 characterId 或 userId');
            const { onlyAngles } = req.body || {};
            const result = await (0, characterService_1.generateImageVariants)(characterId, userId, { onlyAngles });
            return success(res, result);
        }
        catch (err) {
            if (err.message?.includes('余额不足')) {
                return fail(res, 402, 'INSUFFICIENT_BALANCE', err.message);
            }
            next(err);
        }
    },
    /**
     * POST /api/shots/:shotId/generate-image
     * 镜头参考图生成（按张扣费）
     */
    async generateShotImage(req, res, next) {
        try {
            if ((0, maintenance_1.getMaintenance)())
                return fail(res, 503, 'MAINTENANCE', '系统维护中');
            const shotId = req.params.shotId;
            const userId = req.userId;
            if (!shotId || !userId)
                return fail(res, 400, 'BAD_REQUEST', '缺少 shotId 或 userId');
            const result = await (0, characterService_1.generateImageForShot)(shotId, userId);
            return success(res, result);
        }
        catch (err) {
            if (err.message?.includes('余额不足')) {
                return fail(res, 402, 'INSUFFICIENT_BALANCE', err.message);
            }
            next(err);
        }
    },
    /**
     * GET /api/style-presets
     * 列出所有画风预设
     */
    async listStylePresets(req, res, next) {
        try {
            const { queryAll } = await Promise.resolve().then(() => __importStar(require('../models/db')));
            const rows = await queryAll('SELECT * FROM style_presets ORDER BY sort_order');
            return success(res, { presets: rows });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * v2.5.35: POST /api/characters/fix-double-json
     * 一次性修复所有角色的双层 JSON 历史数据 (LLM 误返回的旧 11 字段 JSON 字符串)
     * 仅管理员可调用
     */
    async fixDoubleJsonDescriptions(req, res, next) {
        try {
            const { queryAll, execute } = await Promise.resolve().then(() => __importStar(require('../models/db')));
            const { normalizeOldDescriptionFormat } = await Promise.resolve().then(() => __importStar(require('../services/characterService')));
            // 找出可能含双层 JSON 或 旧英文 key 的角色
            const rows = await queryAll("SELECT id, name, description, extra_description FROM characters WHERE " +
                "description LIKE '%\\\\\\\"%name\\\\\\\":%' " + // 双层 JSON
                "OR description LIKE '{%\\\\\\\"%' " + // 普通 JSON 字符串
                "OR description LIKE '\"{%\\\\\\\"%' " + // 转义的 JSON
                "OR description LIKE '%# 基本%' " + // 新格式 (旧 normalize 输出, 字段名英文)
                "OR description LIKE '%# 五官%' " +
                "OR description LIKE '% age:%' " +
                "OR description LIKE '% gender:%' " +
                "OR description LIKE '% hair_color:%'");
            let fixed = 0;
            let skipped = 0;
            const samples = [];
            for (const r of rows) {
                const oldDesc = r.description;
                const oldExtra = r.extra_description;
                const newDesc = normalizeOldDescriptionFormat(oldDesc);
                const newExtra = oldExtra ? normalizeOldDescriptionFormat(oldExtra) : oldExtra;
                if (newDesc !== oldDesc || newExtra !== oldExtra) {
                    await execute('UPDATE characters SET description = ?, extra_description = ? WHERE id = ?', [newDesc, newExtra, r.id]);
                    fixed++;
                    if (samples.length < 3) {
                        samples.push({ name: r.name, before: oldDesc.length, after: newDesc.length });
                    }
                }
                else {
                    skipped++;
                }
            }
            logger_1.logger.info('fixDoubleJsonDescriptions: 完成', { found: rows.length, fixed, skipped, samples });
            return success(res, { found: rows.length, fixed, skipped, samples });
        }
        catch (err) {
            next(err);
        }
    },
};
