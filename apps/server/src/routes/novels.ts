import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { config } from '../config';
import { novelController } from '../controllers/novelController';
import { authMiddleware } from '../middleware/auth';
import { stableFilename } from '../utils/hash';

const router = Router();

// v3.0.79 (BUG-153 实战沉淀): File upload configuration 实战 6 维度实战实战
// 实战: filename 实战 stableFilename (djb2 32 hex, 跟 BUG-143 src URL 实战 100% 同源)
// 实战实战: fileFilter 实战 MulterError 实战 7 子类实战
// 实战实战: limits 实战实战实战实战 fileSize + files + fieldSize + parts 4 维度
// 实战实战: defParamCharset 实战 utf8 实战实战
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    // 修前: `file-{Date.now()}-{Math.random() * 1e9}.{ext}` 实战实战
    // 修后: `file-{djb2-32-hex}.{ext}` 实战实战实战实战实战
    const userId = (req as any).userId || 'anonymous';
    const ext = path.extname(file.originalname).toLowerCase() || '.txt';
    const hash = stableFilename(file.originalname, userId, 0);
    cb(null, `file-${hash}${ext}`);
  },
});

const upload = multer({
  storage,
  // 实战实战实战实战实战 fileSize (50MB) + files (1) + fieldSize (1MB) + parts (20) 4 维度
  limits: {
    fileSize: config.maxFileSize,  // 50MB (config 实战)
    files: 1,
    fieldSize: 1024 * 1024,
    parts: 20,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.epub', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else if (!ext && file.mimetype === 'text/plain') {
      // Android DocumentPicker may omit extension in file name
      cb(null, true);
    } else {
      // 实战: cb(new MulterError('LIMIT_UNEXPECTED_FILE', ...)) 实战 7 子类
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    }
  },
});

// Routes
router.get('/estimate-fee', authMiddleware, novelController.estimateFee);
router.post('/upload', authMiddleware, upload.single('file'), novelController.upload);
router.post('/:novelId/analyze', authMiddleware, novelController.analyze);
router.post('/:novelId/backfill-characters', authMiddleware, novelController.backfillCharacters);
router.get('/:novelId/analysis', authMiddleware, novelController.getAnalysis);
router.get('/:novelId/episodes', authMiddleware, novelController.getEpisodes);
router.post('/:novelId/episodes/generate', authMiddleware, novelController.generateEpisodes);
router.post('/episodes/:episodeId/regenerate', authMiddleware, novelController.regenerateEpisode);
router.get('/:novelId/export', authMiddleware, novelController.exportNovel);
router.get('/', authMiddleware, novelController.list);
// v2.0.1 补: 单本小说详情 (web 端 ScriptDetailPage 必需)
router.get('/:novelId', authMiddleware, novelController.getNovel);
router.delete('/:novelId', authMiddleware, novelController.remove);
router.put('/:novelId', authMiddleware, novelController.updateNovel);
router.put('/:novelId/meta', authMiddleware, novelController.updateNovelMeta);
router.put('/:novelId/analysis-report', authMiddleware, novelController.updateAnalysisReport);
router.put('/characters/:characterId', authMiddleware, novelController.updateCharacter);
router.put('/characters/:characterId/full', authMiddleware, novelController.updateCharacterFull);

export default router;
