import { Router } from 'express';
import { episodeController } from '../controllers/episodeController';

const router = Router();

router.get('/:episodeId/shots', episodeController.getShots);
router.post('/:episodeId/shots/generate', episodeController.generateShots);
router.put('/:episodeId/shots/:shotId', episodeController.updateShot);
router.get('/:episodeId', episodeController.getEpisode);
router.put('/:episodeId', episodeController.updateEpisode);

export default router;
