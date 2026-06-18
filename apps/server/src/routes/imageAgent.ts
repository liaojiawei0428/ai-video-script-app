// apps/server/src/routes/imageAgent.ts
// v3.0.0: 生图 Agent 路由 (全部需要登录, 跟 v2.5.36 S13 修复保持一致)

import { Router } from 'express';
import { imageAgentController } from '../controllers/imageAgentController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 全部端点强制鉴权
router.use(authMiddleware);

router.post('/conversations', imageAgentController.createConversation);
router.post('/chat', imageAgentController.chat);
router.post('/translate-plan', imageAgentController.translatePlan);  // v3.0.0.2: 中文方案→英文 prompt
router.put('/plan-fields', imageAgentController.updatePlanFields);    // v3.0.0.2: 用户改 10 字段
router.post('/confirm', imageAgentController.confirm);
router.get('/conversations', imageAgentController.history);
router.get('/conversations/:id', imageAgentController.getById);
// v3.0.0.17: 删除单条会话 (永久删除, 含 image_generations 审计)
router.delete('/conversations/:id', imageAgentController.deleteConversation);

export default router;
