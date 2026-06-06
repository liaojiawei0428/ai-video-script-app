/**
 * v2.0.0 - 大纲/事件图谱 路由
 */
import { Router } from 'express';
import { outlineController } from '../controllers/outlineController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.post('/novels/:novelId/outline/generate', outlineController.generateOutline);
router.get('/novels/:novelId/outline', outlineController.getOutline);
router.put('/novels/:novelId/outline', outlineController.updateOutline);
router.post('/novels/:novelId/outline/confirm', outlineController.confirmOutline);

router.post('/novels/:novelId/plot-graph/generate', outlineController.generatePlotGraph);
router.get('/novels/:novelId/plot-graph', outlineController.getPlotGraph);

export { router as outlineRoutes };
