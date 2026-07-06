"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuth = adminAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'ai-script-jwt-secret-dev';
function adminAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: '请先登录' }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(authHeader.slice(7), JWT_SECRET);
        if (decoded.role !== 'admin') {
            res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '无管理员权限' }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
            return;
        }
        req.userId = decoded.userId;
        next();
    }
    catch {
        res.status(401).json({ success: false, error: { code: 'TOKEN_INVALID', message: '登录已过期' }, meta: { timestamp: new Date().toISOString(), requestId: req.requestId } });
    }
}
