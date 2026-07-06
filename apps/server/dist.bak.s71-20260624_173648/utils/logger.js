"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.generateRequestId = generateRequestId;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const { combine, timestamp, json, errors, printf, colorize } = winston_1.default.format;
const devFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});
// v2.5.36: 日志目录用绝对路径, 避免生产 cwd 变化时写错位置
const logDir = path_1.default.resolve(config_1.config.logDir);
exports.logger = winston_1.default.createLogger({
    level: config_1.config.nodeEnv === 'production' ? 'info' : 'debug',
    defaultMeta: { service: 'ai-script-server' },
    transports: [
        new winston_1.default.transports.Console({
            format: combine(timestamp(), config_1.config.nodeEnv === 'production' ? json() : combine(colorize(), devFormat)),
        }),
    ],
});
if (config_1.config.nodeEnv === 'production') {
    exports.logger.add(new winston_1.default.transports.File({
        filename: path_1.default.join(logDir, 'error.log'),
        level: 'error',
        format: combine(timestamp(), json(), errors({ stack: true })),
    }));
    exports.logger.add(new winston_1.default.transports.File({
        filename: path_1.default.join(logDir, 'combined.log'),
        format: combine(timestamp(), json()),
    }));
}
function generateRequestId() {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
