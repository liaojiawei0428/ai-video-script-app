"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fileParser_1 = require("../fileParser");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
describe('FileParserService', () => {
    let service;
    let tempDir;
    beforeEach(async () => {
        service = new fileParser_1.FileParserService();
        tempDir = await promises_1.default.mkdtemp(path_1.default.join(os_1.default.tmpdir(), 'test-'));
    });
    afterEach(async () => {
        await promises_1.default.rm(tempDir, { recursive: true, force: true });
    });
    describe('parseTxt', () => {
        it('should parse txt file correctly', async () => {
            const filePath = path_1.default.join(tempDir, 'test.txt');
            await promises_1.default.writeFile(filePath, 'Hello World', 'utf-8');
            const result = await service.parseFile(filePath);
            expect(result.content).toBe('Hello World');
            expect(result.title).toBe('test');
        });
    });
    describe('parseFile', () => {
        it('should throw error for unsupported file type', async () => {
            const filePath = path_1.default.join(tempDir, 'test.pdf');
            await promises_1.default.writeFile(filePath, 'content', 'utf-8');
            await expect(service.parseFile(filePath)).rejects.toThrow('Unsupported file type');
        });
        it('should throw error for non-existent file', async () => {
            const filePath = path_1.default.join(tempDir, 'nonexistent.txt');
            await expect(service.parseFile(filePath)).rejects.toThrow();
        });
    });
});
