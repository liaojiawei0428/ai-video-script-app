import { FileParserService } from '../fileParser';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('FileParserService', () => {
  let service: FileParserService;
  let tempDir: string;

  beforeEach(async () => {
    service = new FileParserService();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('parseTxt', () => {
    it('should parse txt file correctly', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello World', 'utf-8');

      const result = await service.parseFile(filePath);
      expect(result.content).toBe('Hello World');
      expect(result.title).toBe('test');
    });
  });

  describe('parseFile', () => {
    it('should throw error for unsupported file type', async () => {
      const filePath = path.join(tempDir, 'test.pdf');
      await fs.writeFile(filePath, 'content', 'utf-8');

      await expect(service.parseFile(filePath)).rejects.toThrow('Unsupported file type');
    });

    it('should throw error for non-existent file', async () => {
      const filePath = path.join(tempDir, 'nonexistent.txt');
      await expect(service.parseFile(filePath)).rejects.toThrow();
    });
  });
});
