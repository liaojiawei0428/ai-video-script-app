import { novelModel } from '../models/novel';
import { characterModel } from '../models/character';
import { taskJobModel } from '../models/taskJob';
import { deepseekService } from './deepseek';
import { fileParserService } from './fileParser';
import { websocketService } from './websocket';
import { novelAnalysisSystemPrompt, novelAnalysisUserPrompt } from '../prompts/novelAnalysis';
import { generateUUID } from '@ai-script/shared-utils';
import { Novel, NovelAnalysis, TaskJob } from '@ai-script/shared-types';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export class NovelService {
  async createNovel(
    title: string,
    author: string,
    filePath: string
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

    const content = await fs.readFile(novel.filePath, 'utf-8');

    const task: TaskJob = {
      id: generateUUID(),
      novelId,
      type: 'analyze',
      status: 'running',
      progress: 0,
      totalSteps: 3,
      currentStep: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await taskJobModel.create(task);
    await novelModel.updateStatus(novelId, 'analyzing');

    try {
      // Step 1: Full text analysis
      await taskJobModel.updateProgress(task.id, 10, 1);
      websocketService.broadcastProgress(novelId, 10, 'analyzing');
      logger.info('Starting novel analysis', { novelId, taskId: task.id });

      const analysisResult = await deepseekService.chatCompletionWithRetry(
        novelAnalysisSystemPrompt,
        novelAnalysisUserPrompt(content),
        0.3
      );

      // Step 2: Parse and save analysis
      await taskJobModel.updateProgress(task.id, 60, 2);
      websocketService.broadcastProgress(novelId, 60, 'analyzing');
      const analysis: NovelAnalysis = JSON.parse(analysisResult);

      await novelModel.updateAnalysis(novelId, {
        genre: analysis.genre,
        theme: analysis.theme,
        style: analysis.style,
        tone: analysis.tone,
      });

      // Save characters
      if (analysis.characters?.length > 0) {
        const characters = analysis.characters.map(char => ({
          id: generateUUID(),
          novelId,
          name: char.name,
          aliases: char.aliases || [],
          appearance: char.appearance || '',
          personality: char.personality || '',
          roleType: (char as any).role_type || 'supporting',
          relationships: char.relationships || [],
          createdAt: Date.now(),
        }));
        await characterModel.bulkCreate(characters);
        logger.info('Characters saved', { novelId, count: characters.length });
      }

      // Step 3: Complete
      await taskJobModel.updateProgress(task.id, 100, 3);
      websocketService.broadcastProgress(novelId, 100, 'completed');
      await taskJobModel.complete(task.id, { analysis });
      await novelModel.updateStatus(novelId, 'analyzed');

      logger.info('Novel analysis completed', { novelId, taskId: task.id });
      return task;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Novel analysis failed', { novelId, taskId: task.id, error: errorMsg });
      websocketService.broadcastProgress(novelId, 0, 'error');
      await taskJobModel.fail(task.id, errorMsg);
      await novelModel.updateStatus(novelId, 'error');
      throw error;
    }
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

    if (novel.filePath) {
      try {
        await fs.unlink(novel.filePath);
      } catch {
        logger.warn('Failed to delete novel file', { filePath: novel.filePath });
      }
    }

    // TODO: Delete related episodes, shots, characters, tasks
    logger.info('Novel deleted', { novelId });
  }
}

export const novelService = new NovelService();
