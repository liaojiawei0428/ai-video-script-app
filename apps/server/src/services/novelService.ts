import { novelModel } from '../models/novel';
import { characterModel } from '../models/character';
import { taskJobModel } from '../models/taskJob';
import { userModel } from '../models/user';
import { billingService } from './billingService';
import { deepseekPool } from './deepseekPool';
import { fileParserService } from './fileParser';
import { websocketService } from './websocket';
import { chunkService } from './chunkService';
import { taskQueue } from './taskQueue';
import { novelAnalysisSystemPrompt, novelAnalysisUserPrompt } from '../prompts/novelAnalysis';
import { generateUUID } from '../shared/utils';
import { Novel, TaskJob, ChunkProgress } from '../shared/types';
import fs from 'fs/promises';
import path from 'path';
import iconv from 'iconv-lite';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export class NovelService {
  private static cancelledNovels = new Set<string>();

  static markCancelled(novelId: string): void {
    NovelService.cancelledNovels.add(novelId);
  }

  static isCancelled(novelId: string): boolean {
    return NovelService.cancelledNovels.has(novelId);
  }

  static clearCancelled(novelId: string): void {
    NovelService.cancelledNovels.delete(novelId);
  }
  async createNovel(
    title: string,
    author: string,
    filePath: string,
    userId?: string
  ): Promise<Novel> {
    const { content, title: parsedTitle } = await fileParserService.parseFile(filePath);

    const novelDir = path.join(config.uploadDir, 'novels');
    await fs.mkdir(novelDir, { recursive: true });

    const novelFilePath = path.join(novelDir, `${generateUUID()}.txt`);
    await fs.writeFile(novelFilePath, content, 'utf-8');

    const novel: Novel = {
      id: generateUUID(),
      title: title || parsedTitle,
      author,
      userId,
      filePath: novelFilePath,
      totalChars: content.length,
      totalWords: content.split(/\s+/).length,
      genre: '',
      theme: '',
      style: '',
      tone: '',
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await novelModel.create(novel);
    logger.info('Novel created', { novelId: novel.id, title: novel.title, totalChars: novel.totalChars });

    return novel;
  }

  async analyzeNovel(novelId: string): Promise<TaskJob> {
    const novel = await novelModel.findById(novelId);
    if (!novel) throw new AppError('NOVEL_NOT_FOUND', `Novel ${novelId} not found`, 404);
    if (!novel.filePath) throw new AppError('VALIDATION_ERROR', 'Novel file not available', 400);

    if (taskQueue.isQueuedOrRunning(novelId)) {
      const existingTaskId = taskQueue.getExistingTaskId(novelId);
      if (existingTaskId) {
        const existing = await taskJobModel.findById(existingTaskId);
        if (existing) return existing;
      }
    }

    const raw = await fs.readFile(novel.filePath);
    let content = iconv.decode(raw, 'utf-8');
    if (content.includes('\uFFFD')) content = iconv.decode(raw, 'gbk');

    const task: TaskJob = {
      id: generateUUID(),
      novelId,
      type: 'analyze',
      status: 'queued',
      progress: 0,
      totalSteps: 3,
      currentStep: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await taskJobModel.create(task);
    await novelModel.updateStatus(novelId, 'analyzing');

    taskQueue.enqueue(novelId, novel.userId || '', task.id, () => this.executeAnalysis(novelId, content, task.id));

    return task;
  }

  private async executeAnalysis(novelId: string, content: string, taskId: string): Promise<void> {
    try {
      logger.info('Starting novel analysis with chunk pipeline', { novelId, taskId, totalChars: content.length });

      // 一次性扣费：按原文总字符数
      await billingService.chargeStep(novelId, 'analyze', content.length);

      // ========== Phase 0-2: 分块管道（非流式，显示进度） ==========
      websocketService.broadcastLlmUpdate(novelId, {
        phase: 'analyzing', step: 'reasoning',
        content: '📄 正在分割小说...（全文约 ' + (content.length / 10000).toFixed(1) + '万字）',
      });
      await taskJobModel.updateProgress(taskId, 3, 1);
      websocketService.broadcastProgress(novelId, 3, 'analyzing');

      // Phase 0: 分块
      const chunks = chunkService.splitIntoChunks(content);

      if (chunks.length === 1) {
        // 小说很短（<=80K），直接走原有流式分析
        logger.info('Novel fits in single chunk, using direct analysis', { novelId, chars: content.length });
        websocketService.broadcastLlmUpdate(novelId, {
          phase: 'analyzing', step: 'reasoning',
          content: '📖 小说字数在单次处理范围内，直接分析...',
        });
        await taskJobModel.updateProgress(taskId, 5, 1);
        websocketService.broadcastProgress(novelId, 5, 'analyzing');

        await this.streamAnalysis(novelId, content, taskId);
        return;
      }

      // 多块处理：逐块分析
      websocketService.broadcastLlmUpdate(novelId, {
        phase: 'analyzing', step: 'reasoning',
        content: `📚 小说需要分 ${chunks.length} 段处理（每段约 ${Math.round(content.length / chunks.length / 1000)}K 字）`,
      });

      // Phase 1: 逐块分析
      logger.info('Starting chunk analysis', { novelId, chunkCount: chunks.length });
      const summaries = await chunkService.analyzeAllChunks(
        chunks,
        novelId,
        (progress: ChunkProgress) => {
          websocketService.broadcastChunkProgress(novelId, progress);
        }
      );

      const failedCount = summaries.filter(s => s.failed).length;
      if (failedCount > 0) {
        logger.warn('Some chunks failed', { novelId, failedCount, total: chunks.length });
        websocketService.broadcastLlmUpdate(novelId, {
          phase: 'analyzing', step: 'reasoning',
          content: `⚠️ 有 ${failedCount} 段分析失败（已跳过，不影响整体结果）`,
        });
      }

      // 进度 75%
      await taskJobModel.updateProgress(taskId, 75, 2);
      websocketService.broadcastProgress(novelId, 75, 'analyzing');

      // Phase 2: 一次性合并
      websocketService.broadcastLlmUpdate(novelId, {
        phase: 'analyzing', step: 'reasoning',
        content: '🔗 正在合并所有段落分析结果...',
      });

      const fullSummary = await chunkService.mergeSummaries(summaries, novelId);
      logger.info('Full summary generated', { novelId, summaryLength: fullSummary.length });

      // 保存全文摘要到数据库
      await novelModel.updateFullSummary(novelId, fullSummary);

      // 进度 85% — 准备最终分析
      await taskJobModel.updateProgress(taskId, 85, 2);
      websocketService.broadcastProgress(novelId, 85, 'analyzing');

      // ========== Phase 3: 流式输出最终分析结果 ==========
      websocketService.broadcastLlmUpdate(novelId, {
        phase: 'analyzing', step: 'reasoning',
        content: '📖 正在基于全文摘要生成分析报告...',
      });

      let fullContent = '';
      await deepseekPool.chatCompletionStreamWithRetry(
        novelAnalysisSystemPrompt,
        novelAnalysisUserPrompt(fullSummary),
        (chunk) => {
          if (NovelService.isCancelled(novelId)) {
            throw new Error('CANCELLED_BY_USER');
          }
          fullContent += chunk;
          websocketService.broadcastLlmUpdate(novelId, {
            phase: 'analyzing', step: 'reasoning',
            content: chunk,
            tokens: fullContent.length,
            stream: true,
          });
        },
        0.3
      );

      // 流式已逐字推送完成
      websocketService.broadcastLlmUpdate(novelId, {
        phase: 'analyzing', step: 'output',
        content: '✅ 小说分析完成',
        tokens: fullContent.length,
      });

      // 解析结构化数据并保存
      await this.parseAndSave(novelId, fullContent, taskId);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Novel analysis failed', { novelId, taskId, error: errorMsg });
      websocketService.broadcastProgress(novelId, 0, 'error');
      await taskJobModel.fail(taskId, errorMsg);
      await novelModel.updateStatus(novelId, 'error');
    }
  }

  /**
   * 短篇小说（<=80K）直接流式分析，不走分块管道
   */
  private async streamAnalysis(novelId: string, content: string, taskId: string): Promise<void> {
    await taskJobModel.updateProgress(taskId, 10, 1);
    websocketService.broadcastProgress(novelId, 10, 'analyzing');

    let fullContent = '';
    await deepseekPool.chatCompletionStreamWithRetry(
      novelAnalysisSystemPrompt,
      novelAnalysisUserPrompt(content),
      (chunk) => {
        if (NovelService.isCancelled(novelId)) {
          throw new Error('CANCELLED_BY_USER');
        }
        fullContent += chunk;
        websocketService.broadcastLlmUpdate(novelId, {
          phase: 'analyzing', step: 'reasoning',
          content: chunk,
          tokens: fullContent.length,
          stream: true,
        });
      },
      0.3
    );

    websocketService.broadcastLlmUpdate(novelId, {
      phase: 'analyzing', step: 'output',
      content: '✅ 小说分析完成',
      tokens: fullContent.length,
    });

    // 后续结构化解析与 executeAnalysis 相同，复用 parseAndSave 方法
    await this.parseAndSave(novelId, fullContent, taskId);
  }

  /**
   * 解析 AI 分析结果并保存到数据库
   */
  private async parseAndSave(novelId: string, fullContent: string, taskId: string): Promise<void> {
    await taskJobModel.updateProgress(taskId, 60, 2);
    websocketService.broadcastProgress(novelId, 60, 'analyzing');

    const extractLine = (emojiPrefix: string, textPrefix: string): string => {
      let re = new RegExp(`${emojiPrefix}[：:](.+)`);
      let m = fullContent.match(re);
      if (m) return m[1].trim();
      re = new RegExp(`^${textPrefix}[：:](.+)`, 'm');
      m = fullContent.match(re);
      if (m) return m[1].trim();
      return '';
    };

    const genre = extractLine('📖 类型', '类型').slice(0, 200);
    const theme = extractLine('📌 主题', '主题').slice(0, 500);
    const style = extractLine('🎨 风格', '风格').slice(0, 500);
    const tone = extractLine('💭 基调', '基调').slice(0, 500);

    let roleSection = fullContent.match(/🎭 角色分析：([\s\S]*?)(?=📜|$)/);
    if (!roleSection) roleSection = fullContent.match(/角色分析[：:]([\s\S]*?)(?=\n\n|\n📜|$)/);
    const parsedChars: Array<{ name: string; appearance: string; personality: string; roleType: string }> = [];
    if (roleSection) {
      const lines = roleSection[1].split('\n');
      let currentChar: any = null;
      for (const line of lines) {
        const nameMatch = line.match(/^\d+\.\s*(\S+?)\s*[-–—]/);
        if (nameMatch) {
          if (currentChar) parsedChars.push(currentChar);
          currentChar = { name: nameMatch[1], appearance: '', personality: '', roleType: 'supporting' };
        } else if (currentChar) {
          const appMatch = line.match(/外貌[：:](.+)/);
          if (appMatch) currentChar.appearance = appMatch[1].trim();
          const perMatch = line.match(/性格[：:](.+)/);
          if (perMatch) currentChar.personality = perMatch[1].trim();
          const typeMatch = line.match(/类型[：:](.+)/);
          if (typeMatch) {
            const t = typeMatch[1].trim();
            currentChar.roleType = t.includes('主角') ? 'protagonist' :
                                   t.includes('反派') ? 'antagonist' :
                                   t.includes('龙套') ? 'minor' : 'supporting';
          }
        }
      }
      if (currentChar) parsedChars.push(currentChar);
    }

    const saveGenre = genre && genre !== 'unknown' && genre !== '未分类' ? genre : '未分类';
    await novelModel.updateAnalysis(novelId, {
      genre: saveGenre, theme, style, tone,
      scenes: [], plotPoints: [],
    });

    // 保存完整分析报告文本
    await novelModel.updateAnalysisReport(novelId, fullContent);
    logger.info('Analysis report saved', { novelId, reportLength: fullContent.length });

    if (parsedChars.length > 0) {
      const characters = parsedChars.map(char => ({
        id: generateUUID(), novelId,
        name: char.name, aliases: [],
        appearance: char.appearance, personality: char.personality,
        roleType: char.roleType as 'protagonist' | 'antagonist' | 'supporting' | 'minor', relationships: [],
        createdAt: Date.now(),
      }));
      await characterModel.bulkCreate(characters);
      logger.info('Characters saved', { novelId, count: characters.length });
    }

    await taskJobModel.updateProgress(taskId, 100, 3);
    websocketService.broadcastProgress(novelId, 100, 'completed');
    await taskJobModel.complete(taskId, { genre: saveGenre, theme, style, tone, characterCount: parsedChars.length });
    await novelModel.updateStatus(novelId, 'analyzed');

    try {
      const novel = await novelModel.findById(novelId);
      if (novel?.userId) await userModel.incrementGenerations(novel.userId);
    } catch {}

    logger.info('Novel analysis completed', { novelId, taskId });
  }

  async getNovel(novelId: string): Promise<Novel | undefined> {
    return novelModel.findById(novelId);
  }

  async listNovels(): Promise<Novel[]> {
    return novelModel.list();
  }

  async deleteNovel(novelId: string): Promise<void> {
    const novel = await novelModel.findById(novelId);
    if (!novel) throw new AppError('NOVEL_NOT_FOUND', `Novel ${novelId} not found`, 404);

    // 1. 标记取消，让正在运行的后台任务停止 AI 调用（不清除标记，保持永久取消状态）
    NovelService.markCancelled(novelId);
    taskQueue.cancel(novelId);

    try {
      // 2. 取消所有正在运行的 task_job
      const { execute, queryAll } = await import('../models/db');
      const runningTasks = await queryAll<any>(
        "SELECT id FROM task_jobs WHERE novel_id = ? AND status IN ('running','queued')",
        [novelId]
      );
      for (const t of runningTasks) {
        await taskJobModel.cancel(t.id);
      }

      // 3. 删除上传文件
      if (novel.filePath) {
        try {
          await fs.unlink(novel.filePath);
        } catch {
          logger.warn('Failed to delete novel file', { filePath: novel.filePath });
        }
      }

      // 4. 级联删除数据库记录
      await execute('DELETE FROM shots WHERE episode_id IN (SELECT id FROM episodes WHERE novel_id = ?)', [novelId]);
      await execute('DELETE FROM episodes WHERE novel_id = ?', [novelId]);
      await execute('DELETE FROM characters WHERE novel_id = ?', [novelId]);
      await execute('DELETE FROM task_jobs WHERE novel_id = ?', [novelId]);
      await execute('DELETE FROM novels WHERE id = ?', [novelId]);

      logger.info('Novel deleted with cascade', { novelId });
    } catch (err) {
      // 删除失败时才清除取消标记
      NovelService.clearCancelled(novelId);
      throw err;
    }
  }
}

export const novelService = new NovelService();
