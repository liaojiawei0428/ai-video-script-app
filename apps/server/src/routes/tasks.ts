import { Router } from 'express';
import { taskController } from '../controllers/taskController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// v2.5.36: 加 authMiddleware — 之前 getProgress 无鉴权
router.use(authMiddleware);

router.get('/:taskId/progress', taskController.getProgress);

export default router;
