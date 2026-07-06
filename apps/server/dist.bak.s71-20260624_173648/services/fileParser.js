"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileParserService = exports.FileParserService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const iconv_lite_1 = __importDefault(require("iconv-lite"));
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
class FileParserService {
    async parseFile(filePath) {
        const ext = path_1.default.extname(filePath).toLowerCase();
        switch (ext) {
            case '.txt':
                return this.parseTxt(filePath);
            case '.epub':
                return this.parseEpub(filePath);
            case '.docx':
                return this.parseDocx(filePath);
            case '':
                // Android DocumentPicker may omit extension; treat as .txt
                return this.parseTxt(filePath);
            default:
                throw new errors_1.AppError('INVALID_FILE_TYPE', `Unsupported file type: ${ext}. Only .txt, .epub, .docx are supported.`, 400);
        }
    }
    async parseTxt(filePath) {
        const buffer = await promises_1.default.readFile(filePath);
        const content = this.decodeText(buffer);
        const title = path_1.default.basename(filePath, '.txt');
        return { content, title };
    }
    /** 自动检测并解码文本文件编码（支持 UTF-8、GBK、GB2312 等） */
    decodeText(buffer) {
        // 尝试 UTF-8 解码
        let content = iconv_lite_1.default.decode(buffer, 'utf-8');
        // 检查是否包含乱码字符（� U+FFFD 表示解码失败）
        if (!content.includes('\uFFFD'))
            return content;
        // UTF-8 解码失败，尝试 GBK
        content = iconv_lite_1.default.decode(buffer, 'gbk');
        if (!content.includes('\uFFFD'))
            return content;
        // 尝试 GB2312
        content = iconv_lite_1.default.decode(buffer, 'gb2312');
        if (!content.includes('\uFFFD'))
            return content;
        // 兜底：返回 UTF-8 解码结果（保留原始内容）
        logger_1.logger.warn('Text encoding detection: all attempts may have issues, using GBK result');
        return iconv_lite_1.default.decode(buffer, 'gbk');
    }
    async parseEpub(filePath) {
        try {
            const epubModule = await Promise.resolve().then(() => __importStar(require('epub')));
            const EPub = epubModule.default || epubModule.EPub;
            const epub = new EPub(filePath);
            return new Promise((resolve, reject) => {
                epub.on('end', () => {
                    const title = epub.metadata.title || path_1.default.basename(filePath, '.epub');
                    let content = '';
                    const chapters = epub.flow;
                    let processed = 0;
                    if (chapters.length === 0) {
                        resolve({ content: '', title });
                        return;
                    }
                    chapters.forEach((chapter) => {
                        epub.getChapter(chapter.id, (err, text) => {
                            if (err) {
                                logger_1.logger.warn(`Failed to read chapter ${chapter.id}`, { error: err.message });
                            }
                            else {
                                content += text + '\n\n';
                            }
                            processed++;
                            if (processed === chapters.length) {
                                resolve({ content: this.cleanHtml(content), title });
                            }
                        });
                    });
                });
                epub.on('error', (err) => {
                    reject(new errors_1.AppError('INVALID_FILE_TYPE', `Failed to parse EPUB: ${err.message}`, 400));
                });
                epub.parse();
            });
        }
        catch {
            throw new errors_1.AppError('INVALID_FILE_TYPE', 'EPUB parsing not available. Please install "epub" package.', 400);
        }
    }
    async parseDocx(filePath) {
        try {
            const mammoth = await Promise.resolve().then(() => __importStar(require('mammoth')));
            const result = await mammoth.extractRawText({ path: filePath });
            const title = path_1.default.basename(filePath, '.docx');
            return { content: result.value, title };
        }
        catch {
            throw new errors_1.AppError('INVALID_FILE_TYPE', 'DOCX parsing not available. Please install "mammoth" package.', 400);
        }
    }
    cleanHtml(html) {
        return html
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }
}
exports.FileParserService = FileParserService;
exports.fileParserService = new FileParserService();
