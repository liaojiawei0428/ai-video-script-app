"use strict";
// apps/server/src/routes/imageAgent.ts
// v3.0.0: 生图 Agent 路由 (全部需要登录, 跟 v2.5.36 S13 修复保持一致)
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const imageAgentController_1 = require("../controllers/imageAgentController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// 全部端点强制鉴权
router.use(auth_1.authMiddleware);
router.post('/conversations', imageAgentController_1.imageAgentController.createConversation);
router.post('/chat', imageAgentController_1.imageAgentController.chat);
router.post('/translate-plan', imageAgentController_1.imageAgentController.translatePlan); // v3.0.0.2: 中文方案→英文 prompt
router.put('/plan-fields', imageAgentController_1.imageAgentController.updatePlanFields); // v3.0.0.2: 用户改 10 字段
router.post('/confirm', imageAgentController_1.imageAgentController.confirm);
router.get('/conversations', imageAgentController_1.imageAgentController.history);
router.get('/conversations/:id', imageAgentController_1.imageAgentController.getById);
// v3.0.0.17: 删除单条会话 (永久删除, 含 image_generations 审计)
router.delete('/conversations/:id', imageAgentController_1.imageAgentController.deleteConversation);
exports.default = router;
