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
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rechargeRequest_1 = require("../models/rechargeRequest");
const config_1 = require("../config");
const ipService_1 = require("../services/ipService");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
router.get('/qrcode', async (req, res) => {
    res.json({ success: true, data: { qrCodeUrl: config_1.config.qrCodeUrl } });
});
/** 直接返回收款码图片（手机无法访问 maque.uno 时通过 API 中转） */
router.get('/qr-image', (req, res) => {
    // v2.5.36: 路径从 config.qrLocalPath 读, 避免硬编码
    const imgPath = path_1.default.resolve(config_1.config.qrLocalPath);
    if (fs_1.default.existsSync(imgPath)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        fs_1.default.createReadStream(imgPath).pipe(res);
    }
    else {
        res.status(404).send('QR code not found');
    }
});
router.post('/submit', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const { amount } = req.body;
        const topUpAmount = parseFloat(amount || '0');
        if (isNaN(topUpAmount) || topUpAmount <= 0) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '金额无效' } });
        }
        const ip = req.ip || req.socket.remoteAddress || '';
        const ipLocation = await (0, ipService_1.lookupIp)(ip);
        const { userModel } = await Promise.resolve().then(() => __importStar(require('../models/user')));
        const user = await userModel.findById(userId);
        const record = await rechargeRequest_1.rechargeRequestModel.create(userId, user?.username || '', topUpAmount, ip, ipLocation);
        res.json({
            success: true,
            data: {
                id: record.id,
                amount: record.amount,
                qrCodeUrl: config_1.config.qrCodeUrl,
                message: '请使用支付宝扫描收款码支付 ¥' + topUpAmount.toFixed(2) + '，完成后点击"我已付款"提交审核',
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '提交失败' } });
    }
});
router.get('/my', auth_1.authMiddleware, async (req, res) => {
    const userId = req.userId;
    const records = await rechargeRequest_1.rechargeRequestModel.findByUserId(userId);
    res.json({ success: true, data: { records } });
});
exports.default = router;
