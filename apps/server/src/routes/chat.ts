import { Router } from 'express';
import { chatController } from '../controllers/chatController';

const router = Router();

router.post('/', chatController.send);

export default router;
