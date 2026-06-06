// 角色一致性 v2.0 路由

import { Router } from 'express';
import { characterController } from '../controllers/characterController';
import { episodeController } from '../controllers/episodeController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 角色相关 (单个角色)
router.get('/characters/:characterId', authMiddleware, characterController.getOne);
router.post('/characters/:characterId/confirm', authMiddleware, characterController.confirm);
router.post('/characters/:characterId/generate-images', authMiddleware, characterController.generateImages);

// 镜头生图
router.post('/shots/:shotId/generate-image', authMiddleware, characterController.generateShotImage);
// v2.5.12: 编辑镜头 (仅文字字段, 不涉及生图)
router.put('/shots/:shotId', authMiddleware, episodeController.updateShot);

// 小说级角色
router.post('/novels/:novelId/characters/extract', authMiddleware, characterController.extract);
router.get('/novels/:novelId/characters', authMiddleware, characterController.listByNovel);

// 画风预设
router.get('/style-presets', authMiddleware, characterController.listStylePresets);

export default router;
