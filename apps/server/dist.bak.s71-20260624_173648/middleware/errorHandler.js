"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
function errorHandler(err, req, res, _next) {
    const requestId = req.requestId || 'unknown';
    if (err instanceof errors_1.AppError) {
        logger_1.logger.warn(`Application error [${err.code}]`, {
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
    logger_1.logger.error('Unexpected error', {
        requestId,
        error: err.message,
        stack: err.stack,
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
