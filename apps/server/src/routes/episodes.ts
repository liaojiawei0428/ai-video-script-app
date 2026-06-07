import { Router } from 'express';
import { episodeController } from '../controllers/episodeController';

const router = Router();

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
