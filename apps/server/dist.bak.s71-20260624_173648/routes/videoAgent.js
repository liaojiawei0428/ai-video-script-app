"use strict";
// apps/server/src/routes/videoAgent.ts
// v3.0.0: 视频 Agent 路由 (全部需要登录)
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const videoAgentController_1 = require("../controllers/videoAgentController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.post('/conversations', videoAgentController_1.videoAgentController.createConversation);
router.post('/chat', videoAgentController_1.videoAgentController.chat);
router.post('/confirm', videoAgentController_1.videoAgentController.confirm);
router.get('/conversations', videoAgentController_1.videoAgentController.history);
router.get('/conversations/:id', videoAgentController_1.videoAgentController.getById);
// v3.0.0.17: 永久删除单条会话
router.delete('/conversations/:id', videoAgentController_1.videoAgentController.deleteConversation);
exports.default = router;
