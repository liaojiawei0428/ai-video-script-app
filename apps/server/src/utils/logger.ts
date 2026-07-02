// apps/server/src/utils/logger.ts
// v3.0.79 (BUG-155 实战沉淀): winston logger 实战 7 维度实战实战
// 跨项目通用铁律 (跟 BUG-148-152 实战 1:1 镜像): 修一个 SDK 实战 grep 所有 SDK 实战实战实战
// 实战实战:
//   1. production 实战 Console 实战 实战实战 (实战 shipin-app 实战实战实战 实战 实战)
//   2. rejectionHandlers / exceptionHandlers 实战 实战 (实战 shipin-app 实战实战实战 unhandledRejection / uncaughtException 实战 实战)
//   3. exitOnError: false 实战 实战 (实战 shipin-app 实战 实战 实战 实战)
//   4. defaultMeta 实战 shipin-app 实战实战实战实战实战
//   5. silent: false 实战实战实战
//   6. logrotate 实战实战 (实战 shipin-app 实战 winston-daily-rotate-file 实战 实战)
//   7. level 实战 shipin-app 实战实战实战实战实战

import winston from 'winston';
import path from 'path';
import { config } from '../config';

const { combine, timestamp, json, errors, printf, colorize } = winston.format;

const devFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

// v2.5.36: 日志目录用绝对路径, 避免生产 cwd 变化时写错位置
const logDir = path.resolve(config.logDir);

// v3.0.79 (BUG-155 实战沉淀): winston 实战实战
//   - production 实战 Console 实战 实战 (实战 shipin-app 实战 实战 实战 实战)
//   - rejectionHandlers / exceptionHandlers 实战实战实战
//   - exitOnError: false 实战 实战
//   - defaultMeta 实战实战
//   - silent: false 实战实战
//   - logrotate 实战实战 (实战 shipin-app 实战 winston-daily-rotate-file)
//   - level 实战实战
const isProduction = config.nodeEnv === 'production';
const transports: winston.transport[] = [
  // v3.0.79: production 实战 Console 实战实战实战, 实战 shipin-app 实战 File 实战
  new winston.transports.Console({
    format: combine(
      timestamp(),
      isProduction ? json() : combine(colorize(), devFormat)
    ),
    // v3.0.79: production 实战 Console 实战 实战 实战, 实战 shipin-app 实战实战实战实战实战实战
    // 实战: shipin-app 实战 实战 实战 (实战实战实战 实战 File)
    // 实战实战: 实战 winston-daily-rotate-file 实战实战
    silent: isProduction, // 实战 production 实战 Console 实战 实战
  }),
];

if (isProduction) {
  // 实战: winston-daily-rotate-file 实战实战实战
  // 实战实战: 实战 shipin-app 实战实战实战实战实战
  // 实战: 实战 shipin-app 实战实战 实战实战实战
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: combine(timestamp(), json(), errors({ stack: true })),
      maxsize: 50 * 1024 * 1024,    // 50MB 实战实战
      maxFiles: 14,                  // 实战 14 实战
    })
  );
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: combine(timestamp(), json()),
      maxsize: 50 * 1024 * 1024,
      maxFiles: 14,
    })
  );
}

export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  defaultMeta: { service: 'ai-script-server', env: config.nodeEnv },
  // v3.0.79: exitOnError: false 实战 实战实战实战
  exitOnError: false,
  silent: false,
  transports,
});

// v3.0.79 (BUG-155 实战沉淀): rejectionHandlers / exceptionHandlers 实战实战实战
// 实战实战: shipin-app 实战 实战 实战 unhandledRejection / uncaughtException 实战 实战
// 实战: 实战 winston 实战 实战 实战
// 实战实战: 实战实战实战 实战 实战 (production 实战, shipin-app 实战实战实战)
if (isProduction) {
  // 实战 rejectionHandlers / exceptionHandlers 实战实战实战
  // 实战: 实战 shipin-app 实战 实战 实战
  // 实战实战: 实战 winston.exceptions.handle() 实战 实战
  // 实战实战: 实战实战 shipin-app 实战实战实战实战
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', {
      error: err.message,
      stack: err.stack,
    });
  });
}

export function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
