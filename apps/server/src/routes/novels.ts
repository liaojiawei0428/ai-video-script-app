import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { config } from '../config';
import { novelController } from '../controllers/novelController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.epub', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else if (!ext && file.mimetype === 'text/plain') {
      // Android DocumentPicker may omit extension in file name
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .txt, .epub, .docx are allowed'));
    }
  },
});

// Routes
router.get('/estimate-fee', authMiddleware, novelController.estimateFee);
router.post('/upload', authMiddleware, upload.single('file'), novelController.upload);
router.post('/:novelId/analyze', authMiddleware, novelController.analyze);
router.get('/:novelId/analysis', authMiddleware, novelController.getAnalysis);
router.get('/:novelId/episodes', authMiddleware, novelController.getEpisodes);
router.post('/:novelId/episodes/generate', authMiddleware, novelController.generateEpisodes);
router.post('/episodes/:episodeId/regenerate', authMiddleware, novelController.regenerateEpisode);
router.get('/:novelId/export', authMiddleware, novelController.exportNovel);
router.get('/', authMiddleware, novelController.list);
router.delete('/:novelId', authMiddleware, novelController.remove);
router.put('/:novelId', authMiddleware, novelController.updateNovel);
router.put('/characters/:characterId', authMiddleware, novelController.updateCharacter);

export default router;
