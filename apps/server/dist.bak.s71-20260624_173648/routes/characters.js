"use strict";
// 角色一致性 v2.0 路由
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const characterController_1 = require("../controllers/characterController");
const episodeController_1 = require("../controllers/episodeController");
const auth_1 = require("../middleware/auth");
const adminAuth_1 = require("../middleware/adminAuth");
const router = (0, express_1.Router)();
// 角色相关 (单个角色)
router.get('/characters/:characterId', auth_1.authMiddleware, characterController_1.characterController.getOne);
router.post('/characters/:characterId/confirm', auth_1.authMiddleware, characterController_1.characterController.confirm);
router.post('/characters/:characterId/generate-images', auth_1.authMiddleware, characterController_1.characterController.generateImages);
// 镜头生图
router.post('/shots/:shotId/generate-image', auth_1.authMiddleware, characterController_1.characterController.generateShotImage);
// v2.5.12: 编辑镜头 (仅文字字段, 不涉及生图)
router.put('/shots/:shotId', auth_1.authMiddleware, episodeController_1.episodeController.updateShot);
// 小说级角色
router.post('/novels/:novelId/characters/extract', auth_1.authMiddleware, characterController_1.characterController.extract);
router.get('/novels/:novelId/characters', auth_1.authMiddleware, characterController_1.characterController.listByNovel);
// v2.5.35: 一键修复双层 JSON 历史数据 (admin only, 仅供迁移用)
router.post('/fix-double-json', adminAuth_1.adminAuth, characterController_1.characterController.fixDoubleJsonDescriptions);
// 画风预设
router.get('/style-presets', auth_1.authMiddleware, characterController_1.characterController.listStylePresets);
exports.default = router;
