"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const novelController_1 = require("../controllers/novelController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// File upload configuration
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, config_1.config.uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: config_1.config.maxFileSize },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.txt', '.epub', '.docx'];
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        }
        else if (!ext && file.mimetype === 'text/plain') {
            // Android DocumentPicker may omit extension in file name
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only .txt, .epub, .docx are allowed'));
        }
    },
});
// Routes
router.get('/estimate-fee', auth_1.authMiddleware, novelController_1.novelController.estimateFee);
router.post('/upload', auth_1.authMiddleware, upload.single('file'), novelController_1.novelController.upload);
router.post('/:novelId/analyze', auth_1.authMiddleware, novelController_1.novelController.analyze);
router.post('/:novelId/backfill-characters', auth_1.authMiddleware, novelController_1.novelController.backfillCharacters);
router.get('/:novelId/analysis', auth_1.authMiddleware, novelController_1.novelController.getAnalysis);
router.get('/:novelId/episodes', auth_1.authMiddleware, novelController_1.novelController.getEpisodes);
router.post('/:novelId/episodes/generate', auth_1.authMiddleware, novelController_1.novelController.generateEpisodes);
router.post('/episodes/:episodeId/regenerate', auth_1.authMiddleware, novelController_1.novelController.regenerateEpisode);
router.get('/:novelId/export', auth_1.authMiddleware, novelController_1.novelController.exportNovel);
router.get('/', auth_1.authMiddleware, novelController_1.novelController.list);
// v2.0.1 补: 单本小说详情 (web 端 ScriptDetailPage 必需)
router.get('/:novelId', auth_1.authMiddleware, novelController_1.novelController.getNovel);
router.delete('/:novelId', auth_1.authMiddleware, novelController_1.novelController.remove);
router.put('/:novelId', auth_1.authMiddleware, novelController_1.novelController.updateNovel);
router.put('/:novelId/meta', auth_1.authMiddleware, novelController_1.novelController.updateNovelMeta);
router.put('/:novelId/analysis-report', auth_1.authMiddleware, novelController_1.novelController.updateAnalysisReport);
router.put('/characters/:characterId', auth_1.authMiddleware, novelController_1.novelController.updateCharacter);
router.put('/characters/:characterId/full', auth_1.authMiddleware, novelController_1.novelController.updateCharacterFull);
exports.default = router;
