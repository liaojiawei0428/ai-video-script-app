"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.outlineRoutes = void 0;
/**
 * v2.0.0 - 大纲/事件图谱 路由
 */
const express_1 = require("express");
const outlineController_1 = require("../controllers/outlineController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.outlineRoutes = router;
router.use(auth_1.authMiddleware);
router.post('/novels/:novelId/outline/generate', outlineController_1.outlineController.generateOutline);
router.get('/novels/:novelId/outline', outlineController_1.outlineController.getOutline);
router.put('/novels/:novelId/outline', outlineController_1.outlineController.updateOutline);
router.post('/novels/:novelId/outline/confirm', outlineController_1.outlineController.confirmOutline);
router.post('/novels/:novelId/plot-graph/generate', outlineController_1.outlineController.generatePlotGraph);
router.get('/novels/:novelId/plot-graph', outlineController_1.outlineController.getPlotGraph);
