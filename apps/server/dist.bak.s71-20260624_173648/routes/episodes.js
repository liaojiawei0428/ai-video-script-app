"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const episodeController_1 = require("../controllers/episodeController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// v2.5.36: 加 authMiddleware — 之前全部端点无鉴权, 任何人能查/改任何人的剧集/镜头/导出 PDF/生成漫画(扣费)
router.use(auth_1.authMiddleware);
router.get('/:episodeId/shots', episodeController_1.episodeController.getShots);
router.post('/:episodeId/shots/generate', episodeController_1.episodeController.generateShots);
router.put('/:episodeId/shots/:shotId', episodeController_1.episodeController.updateShot);
router.get('/:episodeId/export', episodeController_1.episodeController.exportEpisode); // v2.0.0
// v2.5.19: 漫画生成
router.post('/:episodeId/comic/generate', episodeController_1.episodeController.generateComic);
router.get('/:episodeId/comic', episodeController_1.episodeController.getComic);
router.get('/:episodeId', episodeController_1.episodeController.getEpisode);
router.put('/:episodeId', episodeController_1.episodeController.updateEpisode);
exports.default = router;
