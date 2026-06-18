import { Router } from 'express';
import { episodeController } from '../controllers/episodeController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// v2.5.36: 加 authMiddleware — 之前全部端点无鉴权, 任何人能查/改任何人的剧集/镜头/导出 PDF/生成漫画(扣费)
router.use(authMiddleware);

router.get('/:episodeId/shots', episodeController.getShots);
router.post('/:episodeId/shots/generate', episodeController.generateShots);
router.put('/:episodeId/shots/:shotId', episodeController.updateShot);
router.get('/:episodeId/export', episodeController.exportEpisode); // v2.0.0
// v2.5.19: 漫画生成
router.post('/:episodeId/comic/generate', episodeController.generateComic);
router.get('/:episodeId/comic', episodeController.getComic);
router.get('/:episodeId', episodeController.getEpisode);
router.put('/:episodeId', episodeController.updateEpisode);

export default router;
