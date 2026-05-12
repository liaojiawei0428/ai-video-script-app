import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { config } from '../config';
import { novelController } from '../controllers/novelController';

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
    } else {
      cb(new Error('Invalid file type. Only .txt, .epub, .docx are allowed'));
    }
  },
});

// Routes
router.post('/upload', upload.single('file'), novelController.upload);
router.post('/:novelId/analyze', novelController.analyze);
router.get('/:novelId/analysis', novelController.getAnalysis);
router.get('/:novelId/episodes', novelController.getEpisodes);
router.post('/:novelId/episodes/generate', novelController.generateEpisodes);
router.get('/:novelId/export', novelController.exportNovel);
router.get('/', novelController.list);

export default router;
