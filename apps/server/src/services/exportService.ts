/**
 * v2.0.0 - 剧集导出 (PDF / Word)
 * 输出: { filename, url, sizeBytes, expiresAt }
 */
import fs from 'fs/promises';
import path from 'path';
import { generateUUID } from '../shared/utils';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { novelModel } from '../models/novel';
import { episodeModel } from '../models/episode';
import { characterModel } from '../models/character';
// pdfkit + docx 在运行时 require (减小启动开销)
type PdfDoc = any;
type DocxBuilder = any;

const EXPORT_DIR = path.join(config.uploadDir, 'exports');
const EXPORT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

async function ensureDir() {
  await fs.mkdir(EXPORT_DIR, { recursive: true });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|\n\r\t]/g, '_').slice(0, 60) || 'episode';
}

interface ExportContext {
  novelTitle: string;
  novelAuthor: string;
  episodeNumber: number;
  episodeTitle: string;
  summary: string;
  durationSec: number;
  sceneLocation: string;
  characters: string[];
  scriptContent: string;
  shots?: { shotNumber: number; description: string; durationSec: number }[];
}

async function buildContext(episodeId: string): Promise<ExportContext> {
  const ep = await episodeModel.findById(episodeId);
  if (!ep) throw new AppError('EPISODE_NOT_FOUND', `Episode ${episodeId} not found`, 404);
  const novel = await novelModel.findById(ep.novelId);
  if (!novel) throw new AppError('NOVEL_NOT_FOUND', `Novel ${ep.novelId} not found`, 404);
  let characters: string[] = [];
  try {
    const chs = await characterModel.findByNovelId(ep.novelId);
    characters = chs.map(c => c.name);
  } catch {}
  return {
    novelTitle: novel.title,
    novelAuthor: novel.author || '',
    episodeNumber: ep.episodeNumber,
    episodeTitle: ep.title || `第${ep.episodeNumber}集`,
    summary: ep.summary || '',
    durationSec: ep.durationSec || 0,
    sceneLocation: ep.sceneLocation || '',
    characters,
    scriptContent: ep.scriptContent || '',
  };
}

async function exportPdf(ctx: ExportContext): Promise<{ filename: string; sizeBytes: number }> {
  const PDFDocument = require('pdfkit');
  await ensureDir();
  const filename = `${safeFilename(ctx.novelTitle)}_E${ctx.episodeNumber}_${safeFilename(ctx.episodeTitle)}.pdf`;
  const filepath = path.join(EXPORT_DIR, filename);
  return new Promise<{ filename: string; sizeBytes: number }>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = require('fs').createWriteStream(filepath);
    stream.on('finish', async () => {
      try {
        const stat = await fs.stat(filepath);
        resolve({ filename, sizeBytes: stat.size });
      } catch (e) { reject(e); }
    });
    stream.on('error', reject);
    doc.pipe(stream);

    // 标题
    doc.fontSize(20).font('Helvetica-Bold').text(ctx.novelTitle, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica').text(`第 ${ctx.episodeNumber} 集  ${ctx.episodeTitle}`, { align: 'center' });
    if (ctx.novelAuthor) {
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#666').text(`作者: ${ctx.novelAuthor}`, { align: 'center' });
    }
    doc.moveDown(1);
    doc.fillColor('#000');

    // 元数据
    doc.fontSize(11);
    if (ctx.summary) {
      doc.font('Helvetica-Bold').text('本集概要');
      doc.font('Helvetica').text(ctx.summary, { align: 'justify' });
      doc.moveDown(0.5);
    }
    if (ctx.durationSec) {
      doc.font('Helvetica-Bold').text(`时长: ${ctx.durationSec} 秒`);
      doc.moveDown(0.5);
    }
    if (ctx.sceneLocation) {
      doc.font('Helvetica-Bold').text(`场景: ${ctx.sceneLocation}`);
      doc.moveDown(0.5);
    }
    if (ctx.characters.length > 0) {
      doc.font('Helvetica-Bold').text(`出场角色: ${ctx.characters.join('、')}`);
      doc.moveDown(1);
    }

    // 剧本内容
    doc.font('Helvetica-Bold').fontSize(13).text('剧本内容');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11);
    const lines = ctx.scriptContent.split('\n');
    for (const line of lines) {
      if (line.trim() === '') { doc.moveDown(0.3); continue; }
      // 角色名:大写中文/英文 + 冒号 = 对话
      const dialogueMatch = line.match(/^([\u4e00-\u9fa5A-Za-z\s]{1,15})[:：]\s*(.+)$/);
      if (dialogueMatch) {
        doc.font('Helvetica-Bold').fillColor('#0066CC').text(dialogueMatch[1].trim() + ':', { continued: true });
        doc.font('Helvetica').fillColor('#000').text(' ' + dialogueMatch[2]);
      } else {
        doc.fillColor('#000').text(line, { align: 'justify' });
      }
    }

    doc.end();
  });
}

async function exportDocx(ctx: ExportContext): Promise<{ filename: string; sizeBytes: number }> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
  await ensureDir();
  const filename = `${safeFilename(ctx.novelTitle)}_E${ctx.episodeNumber}_${safeFilename(ctx.episodeTitle)}.docx`;
  const filepath = path.join(EXPORT_DIR, filename);

  const paragraphs: any[] = [];
  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: ctx.novelTitle, bold: true, size: 36 })],
    alignment: AlignmentType.CENTER, heading: HeadingLevel.TITLE,
  }));
  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: `第 ${ctx.episodeNumber} 集  ${ctx.episodeTitle}`, size: 28 })],
    alignment: AlignmentType.CENTER,
  }));
  if (ctx.novelAuthor) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: `作者: ${ctx.novelAuthor}`, italics: true, color: '666666' })],
      alignment: AlignmentType.CENTER,
    }));
  }
  paragraphs.push(new Paragraph({ children: [new TextRun({ text: '' })] }));

  if (ctx.summary) {
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: '本集概要', bold: true })] }));
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: ctx.summary })] }));
  }
  if (ctx.durationSec) paragraphs.push(new Paragraph({ children: [new TextRun({ text: `时长: ${ctx.durationSec} 秒` })] }));
  if (ctx.sceneLocation) paragraphs.push(new Paragraph({ children: [new TextRun({ text: `场景: ${ctx.sceneLocation}` })] }));
  if (ctx.characters.length > 0) paragraphs.push(new Paragraph({ children: [new TextRun({ text: `出场角色: ${ctx.characters.join('、')}` })] }));

  paragraphs.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  paragraphs.push(new Paragraph({ children: [new TextRun({ text: '剧本内容', bold: true, size: 28 })], heading: HeadingLevel.HEADING_1 }));

  const lines = ctx.scriptContent.split('\n');
  for (const line of lines) {
    if (line.trim() === '') {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
      continue;
    }
    const dialogueMatch = line.match(/^([\u4e00-\u9fa5A-Za-z\s]{1,15})[:：]\s*(.+)$/);
    if (dialogueMatch) {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: dialogueMatch[1].trim() + ': ', bold: true, color: '0066CC' }),
          new TextRun({ text: dialogueMatch[2] }),
        ],
      }));
    } else {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: line })] }));
    }
  }

  const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(filepath, buffer);
  return { filename, sizeBytes: buffer.length };
}

export class ExportService {
  async exportEpisode(episodeId: string, format: 'pdf' | 'docx', baseUrl: string): Promise<{
    filename: string;
    url: string;
    sizeBytes: number;
    expiresAt: number;
  }> {
    const ctx = await buildContext(episodeId);
    const result = format === 'pdf' ? await exportPdf(ctx) : await exportDocx(ctx);
    const url = `${baseUrl}/uploads/exports/${result.filename}`;
    logger.info('ExportService.exportEpisode done', { episodeId, format, filename: result.filename, size: result.sizeBytes });
    return {
      filename: result.filename,
      url,
      sizeBytes: result.sizeBytes,
      expiresAt: Date.now() + EXPORT_TTL_MS,
    };
  }

  // 定期清理过期导出文件
  async cleanupExpired(): Promise<number> {
    try {
      await ensureDir();
      const files = await fs.readdir(EXPORT_DIR);
      const now = Date.now();
      let removed = 0;
      for (const f of files) {
        try {
          const fp = path.join(EXPORT_DIR, f);
          const stat = await fs.stat(fp);
          if (now - stat.mtimeMs > EXPORT_TTL_MS) {
            await fs.unlink(fp);
            removed++;
          }
        } catch {}
      }
      return removed;
    } catch { return 0; }
  }
}

export const exportService = new ExportService();
