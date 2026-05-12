import { episodeModel } from '../models/episode';
import { shotModel } from '../models/shot';
import { characterModel } from '../models/character';
import { novelModel } from '../models/novel';
import { taskJobModel } from '../models/taskJob';
import { deepseekService } from './deepseek';
import { websocketService } from './websocket';
import {
  episodeDivisionSystemPrompt,
  episodeDivisionUserPrompt,
  scriptGenerationSystemPrompt,
  scriptGenerationUserPrompt,
} from '../prompts/episodeGeneration';
import {
  shotGenerationSystemPrompt,
  shotGenerationUserPrompt,
} from '../prompts/shotGeneration';
import { generateUUID, sliceTextAtBoundary } from '@ai-script/shared-utils';
import { Episode, Shot, TaskJob, EpisodePlan } from '@ai-script/shared-types';
import fs from 'fs/promises';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export class ScriptService {
  async generateEpisodes(
    novelId: string,
    targetDuration: number = 120,
    tolerance: number = 10
  ): Promise<TaskJob> {
    const novel = await novelModel.findById(novelId);
    if (!novel?.filePath) throw new AppError('NOVEL_NOT_FOUND', 'Novel not found or no content', 404);

    const content = await fs.readFile(novel.filePath, 'utf-8');

    const task: TaskJob = {
      id: generateUUID(),
      novelId,
      type: 'episode_generate',
      status: 'running',
      progress: 0,
      totalSteps: 4,
      currentStep: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await taskJobModel.create(task);
    await novelModel.updateStatus(novelId, 'generating');

    try {
      // Step 1: Get analysis results
      await taskJobModel.updateProgress(task.id, 10, 1);
      websocketService.broadcastProgress(novelId, 10, 'generating');
      const characters = await characterModel.findByNovelId(novelId);
      const analysis = {
        genre: novel.genre,
        theme: novel.theme,
        style: novel.style,
        tone: novel.tone,
        characters: characters.map(c => ({
          name: c.name,
          appearance: c.appearance,
          personality: c.personality,
          role_type: c.roleType,
        })),
      };

      // Step 2: Generate episode division
      await taskJobModel.updateProgress(task.id, 30, 2);
      websocketService.broadcastProgress(novelId, 30, 'generating');
      logger.info('Starting episode division', { novelId, taskId: task.id });

      const divisionResult = await deepseekService.chatCompletionWithRetry(
        episodeDivisionSystemPrompt,
        episodeDivisionUserPrompt(
          content,
          JSON.stringify(analysis),
          targetDuration,
          tolerance
        ),
        0.5
      );

      const { episodes: episodePlans }: { episodes: EpisodePlan[] } = JSON.parse(divisionResult);
      logger.info('Episode division completed', { novelId, episodeCount: episodePlans.length });

      // Step 3: Generate scripts for each episode
      await taskJobModel.updateProgress(task.id, 50, 3);

      for (let i = 0; i < episodePlans.length; i++) {
        const plan = episodePlans[i];

        // Check if episode already exists (for resume)
        const existingEpisodes = await episodeModel.findByNovelId(novelId);
        const existingEpisode = existingEpisodes.find(e => e.episodeNumber === plan.episodeNumber);
        if (existingEpisode?.status === 'completed') {
          logger.info('Skipping already generated episode', { novelId, episodeNumber: plan.episodeNumber });
          continue;
        }

        // Slice text at paragraph boundaries with overlap
        const episodeText = sliceTextAtBoundary(
          content,
          plan.startCharIndex,
          plan.endCharIndex,
          500
        );

        logger.info('Generating script for episode', {
          novelId,
          episodeNumber: plan.episodeNumber,
          textLength: episodeText.length,
        });

        const scriptResult = await deepseekService.chatCompletionWithRetry(
          scriptGenerationSystemPrompt,
          scriptGenerationUserPrompt(
            episodeText,
            JSON.stringify(characters),
            JSON.stringify(analysis)
          ),
          0.7
        );

        const { script_content, title, duration_estimate } = JSON.parse(scriptResult);

        const episode: Episode = {
          id: existingEpisode?.id || generateUUID(),
          novelId,
          episodeNumber: plan.episodeNumber,
          title: title || plan.title,
          summary: plan.summary,
          durationSec: duration_estimate || plan.estimatedDuration,
          sceneLocation: plan.keyScenes?.[0] || '',
          characters: plan.keyCharacters || [],
          scriptContent: script_content,
          scriptFormat: 'v1',
          status: 'completed',
          createdAt: existingEpisode?.createdAt || Date.now(),
        };

        if (existingEpisode) {
          await episodeModel.updateScript(episode.id, episode.scriptContent);
        } else {
          await episodeModel.create(episode);
        }

        // Update progress
        const progress = 50 + Math.floor(((i + 1) / episodePlans.length) * 40);
        await taskJobModel.updateProgress(task.id, progress, 3);
        websocketService.broadcastProgress(novelId, progress, 'generating');
      }

      // Step 4: Complete
      const completedEpisodes = await episodeModel.findByNovelId(novelId);
      await taskJobModel.complete(task.id, { episodeCount: completedEpisodes.length });
      websocketService.broadcastProgress(novelId, 100, 'completed');
      await novelModel.updateStatus(novelId, 'completed');

      logger.info('Episode generation completed', {
        novelId,
        taskId: task.id,
        episodeCount: completedEpisodes.length,
      });

      return task;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Episode generation failed', { novelId, taskId: task.id, error: errorMsg });
      websocketService.broadcastProgress(novelId, 0, 'error');
      await taskJobModel.fail(task.id, errorMsg);
      await novelModel.updateStatus(novelId, 'error');
      throw error;
    }
  }

  async generateShots(episodeId: string): Promise<TaskJob> {
    const episode = await episodeModel.findById(episodeId);
    if (!episode) throw new AppError('NOVEL_NOT_FOUND', 'Episode not found', 404);

    const characters = await characterModel.findByNovelId(episode.novelId);

    const task: TaskJob = {
      id: generateUUID(),
      novelId: episode.novelId,
      type: 'shot_generate',
      status: 'running',
      progress: 0,
      totalSteps: 2,
      currentStep: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await taskJobModel.create(task);

    try {
      // Generate shots
      await taskJobModel.updateProgress(task.id, 50, 1);
      logger.info('Generating shots', { episodeId, taskId: task.id });

      const shotResult = await deepseekService.chatCompletionWithRetry(
        shotGenerationSystemPrompt,
        shotGenerationUserPrompt(
          episode.scriptContent,
          JSON.stringify(characters),
          JSON.stringify({ location: episode.sceneLocation })
        ),
        0.7
      );

      const { shots: shotData }: { shots: Array<Partial<Shot>> } = JSON.parse(shotResult);

      const shots: Shot[] = shotData.map((shot, index) => ({
        id: generateUUID(),
        episodeId,
        shotNumber: index + 1,
        sceneType: shot.sceneType || 'INT',
        location: shot.location || episode.sceneLocation,
        timeOfDay: shot.timeOfDay || '日',
        description: shot.description || '',
        cameraAngle: shot.cameraAngle || '中景',
        cameraMove: shot.cameraMove || '固定',
        lighting: shot.lighting || '自然光',
        durationSec: shot.durationSec || 5,
        audioNote: shot.audioNote || '',
        dialogue: shot.dialogue || '',
        action: shot.action || '',
        status: 'completed',
      }));

      await shotModel.bulkCreate(shots);

      await taskJobModel.complete(task.id, { shotCount: shots.length });
      logger.info('Shots generation completed', { episodeId, taskId: task.id, shotCount: shots.length });

      return task;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Shot generation failed', { episodeId, taskId: task.id, error: errorMsg });
      await taskJobModel.fail(task.id, errorMsg);
      throw error;
    }
  }
}

export const scriptService = new ScriptService();
