// apps/server/src/routes/videoAgent.ts
// v3.0.0: 视频 Agent 路由 (全部需要登录)

import { Router } from 'express';
import { videoAgentController } from '../controllers/videoAgentController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.post('/conversations', videoAgentController.createConversation);
router.post('/chat', videoAgentController.chat);
router.post('/confirm', videoAgentController.confirm);
router.get('/conversations', videoAgentController.history);
router.get('/conversations/:id', videoAgentController.getById);
// v3.0.0.17: 永久删除单条会话
router.delete('/conversations/:id', videoAgentController.deleteConversation);

export default router;
