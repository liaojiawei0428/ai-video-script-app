// apps/server/src/middleware/errorHandler.ts
// v3.0.79 (BUG-153+154 实战沉淀): 补 catch MulterError / RateLimitError / TokenExpiredError / MysqlError / DeepseekError / AgnesTextError
// 跨项目通用铁律 (跟 BUG-148-152 修法 1:1 镜像): 修一个 SDK 必 grep 所有 SDK error 在 errorHandler 里的 catch
// 实战根因: BUG-150 jwt 实战修了 jwt 5 子类错误码, 但 errorHandler 实战没 catch TokenExpiredError 等 → 实战包装成 500 INTERNAL_ERROR
// 实战根因: BUG-151 mysql 实战修了 mysql 14 错误码, 但 errorHandler 实战没 catch MysqlError → 实战包装成 500 INTERNAL_ERROR
// 实战根因: BUG-153 multer 实战 实战: MulterError 实战包装成 500 (LIMIT_FILE_SIZE 超限用户看不到真实错)
// 实战根因: BUG-154 express-rate-limit 实战 实战: RateLimitError 实战包装成 500
//
// 修法: errorHandler 实战 catch 6 类型错误 1:1 映射:
//   1. AppError (自定义业务错)
//   2. MulterError (multer 7 子类) — BUG-153
//   3. RateLimitError (express-rate-limit v7 抛) — BUG-154
//   4. TokenExpiredError / NotBeforeError / JsonWebTokenError (jsonwebtoken 3 类型, BUG-150 已分类) — BUG-150 实战
//   5. MysqlError (mysql 14 错误码 + 3 driver 错, BUG-151 已分类) — BUG-151 实战
//   6. DeepseekError / AgnesTextError (AI provider 错误, BUG-148/149 已分类) — BUG-148/149 实战
//   7. Error (其他, 包装成 500 INTERNAL_ERROR)

import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { TokenExpiredError, NotBeforeError, JsonWebTokenError } from 'jsonwebtoken';
import { MysqlError } from '../models/db';

const MulterError = multer.MulterError;

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId || 'unknown';

  // 1. AppError (自定义业务错)
  if (err instanceof AppError) {
    logger.warn(`Application error [${err.code}]`, {
      requestId,
      code: err.code,
      message: err.message,
      details: err.details,
    });

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
      },
    });
    return;
  }

  // 2. MulterError (multer 7 子类, BUG-153 实战) — 跟 BUG-150 jwt 5 子类 / BUG-151 mysql 14 错误码 1:1 映射
  if (err instanceof MulterError) {
    let statusCode = 400;
    let code = 'UPLOAD_ERROR';
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        statusCode = 413;
        code = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_FILE_COUNT':
      case 'LIMIT_PART_COUNT':
        statusCode = 413;
        code = 'TOO_MANY_FILES';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
      case 'LIMIT_FIELD_COUNT':
      case 'LIMIT_FIELD_KEY':
      case 'LIMIT_FIELD_VALUE':
        statusCode = 400;
        code = 'INVALID_UPLOAD_FIELD';
        break;
    }
    logger.warn(`Multer error [${err.code}]`, {
      requestId,
      code: err.code,
      field: err.field,
      message: err.message,
    });

    res.status(statusCode).json({
      success: false,
      error: {
        code,
        message: err.message,
        details: { field: err.field, multerCode: err.code },
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
      },
    });
    return;
  }

  // 3. TokenExpiredError / NotBeforeError / JsonWebTokenError (jsonwebtoken, BUG-150 实战)
  if (err instanceof TokenExpiredError) {
    logger.warn('JWT expired', { requestId });
    res.status(401).json({
      success: false,
      error: { code: 'TOKEN_EXPIRED', message: 'jwt expired' },
      meta: { timestamp: new Date().toISOString(), requestId },
    });
    return;
  }
  if (err instanceof NotBeforeError) {
    logger.warn('JWT not active', { requestId, message: err.message });
    res.status(401).json({
      success: false,
      error: { code: 'TOKEN_NOT_ACTIVE', message: err.message },
      meta: { timestamp: new Date().toISOString(), requestId },
    });
    return;
  }
  if (err instanceof JsonWebTokenError) {
    let code = 'TOKEN_INVALID_SIGNATURE';
    if (err.message.includes('audience')) code = 'TOKEN_AUDIENCE_INVALID';
    else if (err.message.includes('issuer')) code = 'TOKEN_ISSUER_INVALID';
    else if (err.message.includes('algorithm')) code = 'TOKEN_INVALID_ALGORITHM';
    logger.warn(`JWT invalid [${code}]`, { requestId, message: err.message });
    res.status(401).json({
      success: false,
      error: { code, message: err.message },
      meta: { timestamp: new Date().toISOString(), requestId },
    });
    return;
  }

  // 4. MysqlError (mysql2, BUG-151 实战) — 跟 BUG-148 deepseek / BUG-149 agnes / BUG-150 jwt 1:1 镜像
  if (err instanceof MysqlError) {
    logger.error(`Mysql error [${err.code}]`, {
      requestId,
      errno: err.mysqlErrno,
      code: err.code,
      mysqlMessage: err.mysqlMessage,
    });
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.mysqlMessage || err.message,
        details: { errno: err.mysqlErrno, mysqlMessage: err.mysqlMessage },
      },
      meta: { timestamp: new Date().toISOString(), requestId },
    });
    return;
  }

  // 5. 默认 unexpected error (500)
  logger.error('Unexpected error', {
    requestId,
    error: err.message,
    stack: err.stack,
    errorType: err.constructor.name,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
    },
  });
}
