import { Router } from 'express';
import { taskController } from '../controllers/taskController';

const router = Router();

router.get('/:taskId/progress', taskController.getProgress);

export default router;
