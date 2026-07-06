"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCodes = exports.AppError = void 0;
class AppError extends Error {
    code;
    statusCode;
    details;
    constructor(code, message, statusCode = 500, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
exports.ErrorCodes = {
    NOVEL_NOT_FOUND: { code: 'NOVEL_NOT_FOUND', statusCode: 404 },
    TASK_NOT_FOUND: { code: 'TASK_NOT_FOUND', statusCode: 404 },
    INVALID_FILE_TYPE: { code: 'INVALID_FILE_TYPE', statusCode: 400 },
    FILE_TOO_LARGE: { code: 'FILE_TOO_LARGE', statusCode: 413 },
    DEEPSEEK_API_ERROR: { code: 'DEEPSEEK_API_ERROR', statusCode: 502 },
    RATE_LIMIT_EXCEEDED: { code: 'RATE_LIMIT_EXCEEDED', statusCode: 429 },
    INTERNAL_ERROR: { code: 'INTERNAL_ERROR', statusCode: 500 },
    VALIDATION_ERROR: { code: 'VALIDATION_ERROR', statusCode: 400 },
};
