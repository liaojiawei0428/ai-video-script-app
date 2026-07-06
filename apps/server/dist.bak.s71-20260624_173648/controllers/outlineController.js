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
exports.outlineController = void 0;
const outlineService_1 = require("../services/outlineService");
const logger_1 = require("../utils/logger");
exports.outlineController = {
    async generateOutline(req, res, next) {
        try {
            const { novelId } = req.params;
            const outline = await outlineService_1.outlineService.generateOutline(novelId);
            res.json({
                success: true,
                data: outline,
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        catch (e) {
            next(e);
        }
    },
    async getOutline(req, res, next) {
        try {
            const { novelId } = req.params;
            const outline = await outlineService_1.outlineService.getOutline(novelId);
            res.json({
                success: true,
                data: outline,
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        catch (e) {
            next(e);
        }
    },
    async updateOutline(req, res, next) {
        try {
            const { novelId } = req.params;
            const { items } = req.body;
            if (!Array.isArray(items)) {
                return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'items 必须为数组' } });
            }
            const existing = await outlineService_1.outlineService.getOutline(novelId);
            if (!existing) {
                return res.status(404).json({ success: false, error: { code: 'OUTLINE_NOT_FOUND', message: '大纲不存在' } });
            }
            // 用户编辑后取消确认状态, 需重新确认
            const updated = { ...existing, items, generatedAt: Date.now(), confirmedAt: undefined };
            const { novelModel } = await Promise.resolve().then(() => __importStar(require('../models/novel')));
            await novelModel.updateOutline(novelId, JSON.stringify(updated));
            res.json({
                success: true,
                data: updated,
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        catch (e) {
            next(e);
        }
    },
    async confirmOutline(req, res, next) {
        try {
            const { novelId } = req.params;
            const outline = await outlineService_1.outlineService.confirmOutline(novelId);
            logger_1.logger.info('Outline confirmed', { novelId });
            res.json({
                success: true,
                data: outline,
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        catch (e) {
            next(e);
        }
    },
    async generatePlotGraph(req, res, next) {
        try {
            const { novelId } = req.params;
            const graph = await outlineService_1.outlineService.generatePlotGraph(novelId);
            res.json({
                success: true,
                data: graph,
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        catch (e) {
            next(e);
        }
    },
    async getPlotGraph(req, res, next) {
        try {
            const { novelId } = req.params;
            const graph = await outlineService_1.outlineService.getPlotGraph(novelId);
            res.json({
                success: true,
                data: graph,
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
            });
        }
        catch (e) {
            next(e);
        }
    },
};
