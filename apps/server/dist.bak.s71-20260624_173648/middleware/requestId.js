"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = requestIdMiddleware;
const logger_1 = require("../utils/logger");
function requestIdMiddleware(req, res, next) {
    req.requestId = (0, logger_1.generateRequestId)();
    res.setHeader('X-Request-Id', req.requestId);
    next();
}
