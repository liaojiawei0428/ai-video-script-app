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

export const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  defaultMeta: { service: 'ai-script-server' },
  transports: [
    new winston.transports.Console({
      format: combine(
        timestamp(),
        config.nodeEnv === 'production' ? json() : combine(colorize(), devFormat)
      ),
    }),
  ],
});

if (config.nodeEnv === 'production') {
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: combine(timestamp(), json(), errors({ stack: true })),
    })
  );
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: combine(timestamp(), json()),
    })
  );
}

export function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
