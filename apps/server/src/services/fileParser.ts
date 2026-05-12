import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export class FileParserService {
  async parseFile(filePath: string): Promise<{ content: string; title: string }> {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.txt':
        return this.parseTxt(filePath);
      case '.epub':
        return this.parseEpub(filePath);
      case '.docx':
        return this.parseDocx(filePath);
      default:
        throw new AppError(
          'INVALID_FILE_TYPE',
          `Unsupported file type: ${ext}. Only .txt, .epub, .docx are supported.`,
          400
        );
    }
  }

  private async parseTxt(filePath: string): Promise<{ content: string; title: string }> {
    const content = await fs.readFile(filePath, 'utf-8');
    const title = path.basename(filePath, '.txt');
    return { content, title };
  }

  private async parseEpub(filePath: string): Promise<{ content: string; title: string }> {
    try {
      const epubModule = await import('epub') as any;
      const EPub = epubModule.default || epubModule.EPub;
      const epub = new EPub(filePath);

      return new Promise((resolve, reject) => {
        epub.on('end', () => {
          const title = epub.metadata.title || path.basename(filePath, '.epub');
          let content = '';

          const chapters = epub.flow;
          let processed = 0;

          if (chapters.length === 0) {
            resolve({ content: '', title });
            return;
          }

          chapters.forEach((chapter: any) => {
            epub.getChapter(chapter.id, (err: Error | null, text: string) => {
              if (err) {
                logger.warn(`Failed to read chapter ${chapter.id}`, { error: err.message });
              } else {
                content += text + '\n\n';
              }
              processed++;
              if (processed === chapters.length) {
                resolve({ content: this.cleanHtml(content), title });
              }
            });
          });
        });

        epub.on('error', (err: Error) => {
          reject(new AppError('INVALID_FILE_TYPE', `Failed to parse EPUB: ${err.message}`, 400));
        });

        epub.parse();
      });
    } catch {
      throw new AppError(
        'INVALID_FILE_TYPE',
        'EPUB parsing not available. Please install "epub" package.',
        400
      );
    }
  }

  private async parseDocx(filePath: string): Promise<{ content: string; title: string }> {
    try {
      const mammoth = await import('mammoth') as any;
      const result = await mammoth.extractRawText({ path: filePath });
      const title = path.basename(filePath, '.docx');
      return { content: result.value, title };
    } catch {
      throw new AppError(
        'INVALID_FILE_TYPE',
        'DOCX parsing not available. Please install "mammoth" package.',
        400
      );
    }
  }

  private cleanHtml(html: string): string {
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

export const fileParserService = new FileParserService();
