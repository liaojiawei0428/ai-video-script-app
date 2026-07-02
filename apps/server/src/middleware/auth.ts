// apps/server/src/middleware/auth.ts
// v3.0.78 (BUG-150): JWT verify 必填 options (跟 BUG-148/149 deepseek/agnes 修法 1:1 镜像)
// 官方文档 https://github.com/auth0/node-jsonwebtoken 必查: algorithms/audience/issuer/clockTolerance/expiresIn 5 字段
// 错误码严格分类: TokenExpiredError / NotBeforeError / JsonWebTokenError (细分 audience/issuer/signature 4 子类)
// 跟 BUG-148 deepseek mapDeepseekError + BUG-149 agnes classifyAgnesTextError 1:1 镜像, 透传 upstream errMessage

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'ai-script-jwt-secret-dev';

// v3.0.78 (BUG-150): JWT verify 必填 options
const JWT_VERIFY_OPTIONS: jwt.VerifyOptions = {
  algorithms: ['HS256'],               // 显式限制算法, 防 algorithm confusion attack (攻击者用 RS256 公钥伪造 token)
  audience: process.env.JWT_AUDIENCE || 'shipin-app-users',  // 跨服务 token 隔离, 防止其他服务 token 误用
  issuer: process.env.JWT_ISSUER || 'shipin-APP',  // 跟 sign 对齐
  clockTolerance: 30,                  // 容忍 30s 时钟差 (客户端/服务器边缘过期)
};

// v2.5.36: 生产环境强制要求 JWT_SECRET, 不能用 dev 默认值 (安全防护)
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'ai-script-jwt-secret-dev') {
  throw new Error('JWT_SECRET is required in production (dev default is not allowed)');
}

// v3.0.78 (BUG-150): sign 必带 audience + issuer (跟 verify 对齐)
// export 出来给 userController + admin controller 用, 避免每处重复 sign options
export const JWT_SIGN_OPTIONS: jwt.SignOptions = {
  algorithm: 'HS256',
  audience: process.env.JWT_AUDIENCE || 'shipin-app-users',
  issuer: process.env.JWT_ISSUER || 'shipin-APP',
};

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // v3.0.0: 同时支持 Authorization header + ?token= query (供 <a download href> 用, 因为浏览器 GET 不会自动带 Authorization 头)
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (queryToken) {
    token = queryToken;
  } else {
    res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: '请先登录' },
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTIONS) as { userId: string };
    (req as any).userId = decoded.userId;
    next();
  } catch (err: any) {
    // v3.0.78 (BUG-150): 错误码严格分类 (跟 BUG-148 deepseek mapDeepseekError / BUG-149 agnes classifyAgnesTextError 1:1 镜像)
    // 官方文档 3 种错误类型: TokenExpiredError / JsonWebTokenError / NotBeforeError
    let code = 'TOKEN_INVALID';
    let message = '登录已过期, 请重新登录';

    if (err?.name === 'TokenExpiredError') {
      // 前端看到 TOKEN_EXPIRED 走 refresh token 流程, 不需要重新登录
      code = 'TOKEN_EXPIRED';
      message = '登录已过期, 请刷新 token';
    } else if (err?.name === 'NotBeforeError') {
      code = 'TOKEN_NOT_ACTIVE';
      message = 'token 尚未生效, 请稍后重试';
    } else if (err?.name === 'JsonWebTokenError') {
      // 细分 'invalid signature' / 'invalid algorithm' / 'jwt malformed' / 'jwt audience invalid' / 'jwt issuer invalid' 等
      if (err.message?.includes('audience')) {
        code = 'TOKEN_AUDIENCE_INVALID';
        message = 'token audience 无效';
      } else if (err.message?.includes('issuer')) {
        code = 'TOKEN_ISSUER_INVALID';
        message = 'token issuer 无效';
      } else if (err.message?.includes('signature')) {
        code = 'TOKEN_INVALID_SIGNATURE';
        message = 'token 签名无效';
      } else if (err.message?.includes('algorithm')) {
        // v3.0.78 (BUG-150): 防 algorithm confusion attack, 错 alg 应明确提示
        code = 'TOKEN_INVALID_ALGORITHM';
        message = 'token 算法不被允许 (仅支持 HS256)';
      } else {
        code = 'TOKEN_INVALID';
        message = 'token 无效';
      }
    }

    // v3.0.78 (BUG-150): 透传 err.message 让前端能看到真实错误 (跟 deepseek/agnes 修法 1:1 镜像, 不包装 upstream 错误)
    logger.warn('JWT verify failed', {
      errName: err?.name,
      errMessage: err?.message,
      code,
      requestId: req.requestId,
    });

    res.status(401).json({
      success: false,
      error: { code, message, upstream: err?.message },  // 透传 upstream errMessage, 前端调试可见
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    });
  }
}

/** 可选认证：有 token 就解析 userId，没有也不拒绝 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET, JWT_VERIFY_OPTIONS) as { userId: string };
      (req as any).userId = decoded.userId;
    } catch (err: any) {
      // v3.0.78 (BUG-150): 静默吞错改为 logger.warn, 生产安全可见 (跟 BUG-148 修法 4 1:1 镜像, 不静默丢错)
      logger.warn('optionalAuth: token invalid, ignored', {
        errName: err?.name,
        errMessage: err?.message,
        requestId: req.requestId,
      });
    }
  }
  next();
}
