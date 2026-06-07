// apps/server/src/services/comicService.ts
// v2.5.20: 漫画生成服务 - JSON 模板架构
// 数据源唯一性: 仅使用 episode.scriptContent 和 episode 的 shots 数组, 禁止硬写入参考内容
// v2.5.20 重构: 使用多风格统一生成 JSON 模板, 每格内容严格独立

import { episodeModel } from '../models/episode';
import { novelModel } from '../models/novel';
import { characterModel } from '../models/character';
import { shotModel } from '../models/shot';
import { taskJobModel } from '../models/taskJob';
import { billingService } from './billingService';
import { imageProvider } from './imageProvider';
import { websocketService } from './websocket';
import { taskQueue } from './taskQueue';
import { generateUUID } from '../shared/utils';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { NovelService } from './novelService';
import { TaskJob } from '../shared/types';
import {
  comicGenerationSystemPrompt,
  comicGenerationUserPrompt,
  calculateComicLayout,
  inferComicStyle,
  ComicLayout,
  ComicStyle,
  ComicShotInput,
  ComicCharacterInput,
} from '../prompts/comicGeneration';

export class ComicService {

  /** 入口: 队列任务并立即返回 task */
  async generateComic(episodeId: string): Promise<TaskJob> {
    const episode = await episodeModel.findById(episodeId);
    if (!episode) throw new AppError('EPISODE_NOT_FOUND', 'Episode not found', 404);

    const shots = await shotModel.findByEpisodeId(episodeId);
    if (!shots || shots.length === 0) {
      throw new AppError('NO_SHOTS', '请先生成分镜, 再生成漫画', 400);
    }

    // 检查是否已有生成中的任务 (按 episodeId 维度)
    if (taskQueue.isQueuedOrRunning(episode.novelId + ':comic')) {
      const existingTaskId = taskQueue.getExistingTaskId(episode.novelId + ':comic');
      if (existingTaskId) {
        const existing = await taskJobModel.findById(existingTaskId);
        if (existing) return existing;
      }
    }

    const task: TaskJob = {
      id: generateUUID(),
      novelId: episode.novelId,
      type: 'comic_generate',
      status: 'queued',
      progress: 0,
      totalSteps: 4,
      currentStep: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await taskJobModel.create(task);

    // 用 novelId:comic 作为 key 避免与分镜/分析任务冲突
    const queueKey = episode.novelId + ':comic';
    taskQueue.enqueue(queueKey, '', task.id, () => this.executeComicGeneration(episodeId, task.id));

    return task;
  }

  /** 后台执行漫画生成 */
  private async executeComicGeneration(episodeId: string, taskId: string): Promise<void> {
    const queueKey = (await episodeModel.findById(episodeId))?.novelId + ':comic';
    try {
      const episode = await episodeModel.findById(episodeId);
      if (!episode) throw new Error('Episode not found');
      const novel = await novelModel.findById(episode.novelId);
      const characters = await characterModel.findByNovelId(episode.novelId);
      const shots = await shotModel.findByEpisodeId(episodeId);

      if (!shots || shots.length === 0) throw new Error('没有可用的分镜数据');

      // 1. 准备阶段
      await taskJobModel.updateProgress(taskId, 10, 1);
      websocketService.broadcastLlmUpdate(episode.novelId, {
        phase: 'comic_gen', step: 'preparing',
        content: '🎨 正在准备漫画生成数据...',
        stream: false,
      });
      logger.info('Comic generation start', { episodeId, taskId, shotCount: shots.length });

      // 2. 计算布局 & 扣费守门
      const layoutInfo = calculateComicLayout(shots.length);
      await billingService.guardBalance(episode.novelId, taskId, 'comic', 0, layoutInfo.totalPages);

      // 3. 构建分镜输入 (严格只用 shot 字段, 禁止硬写入)
      const comicShots: ComicShotInput[] = shots.map(s => ({
        shotNumber: s.shotNumber,
        sceneType: s.sceneType || '',
        cameraMove: s.cameraMove || '',
        visual: extractVisualFromDescription(s.description || ''),
        dialogue: s.dialogue || '',
        lighting: s.lighting || '',
        colorTone: '',  // 暂未持久化 colorTone 字段
        audioNote: s.audioNote || '',
        imagePrompt: (s as any).imagePrompt || '',
      }));

      // 4. 角色输入 (从 characters 表读取描述)
      const comicCharacters: ComicCharacterInput[] = characters.map(c => ({
        name: c.name,
        description: (c as any).description || '',
      }));

      // 5. 风格 (v2.5.20: 从 novel styleBible 自动推断)
      const styleBible = (novel as any)?.styleBible;
      const comicStyle: ComicStyle = inferComicStyle(styleBible);

      // 6. 扣费
      await billingService.chargeStep(episode.novelId, 'comic', 0, layoutInfo.totalPages);

      // 7. 分页生成 (v2.5.19 支持多页, v2.5.20 JSON 模板)
      const episodeTitle = episode.title || `第 ${episode.episodeNumber} 集`;
      const episodeScript = episode.scriptContent || '';
      const allPageImages: string[] = [];

      for (let page = 1; page <= layoutInfo.totalPages; page++) {
        if (NovelService.isCancelled(queueKey)) throw new Error('CANCELLED_BY_USER');

        const startIdx = (page - 1) * layoutInfo.shotsPerPage;
        const endIdx = Math.min(startIdx + layoutInfo.shotsPerPage, shots.length);
        const pageShots = comicShots.slice(startIdx, endIdx);

        await taskJobModel.updateProgress(
          taskId,
          20 + Math.floor((page - 1) / layoutInfo.totalPages * 60),
          2
        );
        websocketService.broadcastLlmUpdate(episode.novelId, {
          phase: 'comic_gen', step: 'building_prompt',
          content: `📝 正在构建第 ${page}/${layoutInfo.totalPages} 页 JSON 提示词 (含 ${pageShots.length} 个分镜, 风格: ${comicStyle})...`,
          stream: false,
        });

        const layout = layoutInfo.layout;
        const systemPrompt = comicGenerationSystemPrompt(comicStyle, layout, comicCharacters);
        const userPrompt = comicGenerationUserPrompt({
          pageNumber: page,
          totalPages: layoutInfo.totalPages,
          episodeTitle,
          episodeScript,
          shots: pageShots,
          characters: comicCharacters,
          style: comicStyle,
          layout,
        });

        websocketService.broadcastLlmUpdate(episode.novelId, {
          phase: 'comic_gen', step: 'generating',
          content: `🖌️ AI 正在生成第 ${page}/${layoutInfo.totalPages} 页漫画 (${layout} 网格)...`,
          stream: false,
        });

        try {
          const startMs = Date.now();
          const result = await imageProvider.generate({
            prompt: systemPrompt + '\n\n' + userPrompt,
            styleId: (novel as any)?.styleId,
            angle: 'comic' as any,
            width: 2048,
            height: 2048,
            seed: Date.now() + page,
          });
          const durationMs = Date.now() - startMs;

          allPageImages.push(result.url);
          logger.info('Comic page generated', {
            episodeId, taskId, page, totalPages: layoutInfo.totalPages,
            layout, durationMs, imageLen: result.url.length,
          });
          websocketService.broadcastLlmUpdate(episode.novelId, {
            phase: 'comic_gen', step: 'generating',
            content: `✅ 第 ${page}/${layoutInfo.totalPages} 页完成 (${Math.round(durationMs/1000)}s)`,
            stream: false,
          });

          // v2.5.19: 每生成一页就立即持久化, 防止后续页失败导致全部丢失
          const partialUrl = allPageImages.length === 1
            ? allPageImages[0]
            : JSON.stringify(allPageImages);
          await episodeModel.update(episodeId, {
            comicImageUrl: partialUrl,
            comicGeneratedAt: Date.now(),
            comicLayout: layoutInfo.layout,
            comicTotalPages: layoutInfo.totalPages,
          } as any);
          logger.info('Comic partial saved', {
            episodeId, taskId, page, totalPages: layoutInfo.totalPages,
            completedPages: allPageImages.length,
          });
        } catch (pageErr: any) {
          const errMsg = pageErr?.message || 'unknown';
          logger.error('Comic page failed', {
            episodeId, taskId, page, totalPages: layoutInfo.totalPages, error: errMsg,
          });
          websocketService.broadcastLlmUpdate(episode.novelId, {
            phase: 'comic_gen', step: 'error',
            content: `❌ 第 ${page}/${layoutInfo.totalPages} 页生成失败: ${errMsg} (前 ${allPageImages.length} 页已保存)`,
            stream: false,
          });
          // v2.5.19: 即使后续页失败, 已成功的页仍然保存, 直接跳出循环
          throw new Error(`第 ${page} 页失败: ${errMsg} (已完成 ${allPageImages.length} 页)`);
        }
      }

      // 8. 保存到 DB
      // v2.5.19 多页用 JSON 数组存储; 单页也兼容
      const comicImageUrl = allPageImages.length === 1
        ? allPageImages[0]
        : JSON.stringify(allPageImages);

      await episodeModel.update(episodeId, {
        comicImageUrl,
        comicGeneratedAt: Date.now(),
        comicLayout: layoutInfo.layout,
        comicTotalPages: layoutInfo.totalPages,
      } as any);

      await taskJobModel.updateProgress(taskId, 100, 4);
      await taskJobModel.complete(taskId, { totalPages: layoutInfo.totalPages, layout: layoutInfo.layout });

      websocketService.broadcastLlmUpdate(episode.novelId, {
        phase: 'comic_gen', step: 'done',
        content: `🎉 漫画生成完成! 共 ${layoutInfo.totalPages} 页 (${layoutInfo.layout} 布局)`,
        stream: false,
      });
      websocketService.broadcastTaskUpdate(episode.novelId, {
        id: taskId, status: 'completed', progress: 100,
      });

      // 9. 系统通知
      try {
        const { notifySuccess } = await import('./notify');
        const userId = (novel as any)?.userId;
        if (userId) {
          await notifySuccess(userId, '漫画生成完成',
            `《${(novel as any)?.title || '未知小说'}》${episodeTitle} 已生成 ${layoutInfo.totalPages} 页漫画 (${layoutInfo.layout} 布局)。`,
            episodeId);
        }
      } catch (e) {
        logger.warn('Comic notify failed', { error: (e as Error).message });
      }

      logger.info('Comic generation done', {
        episodeId, taskId,
        totalPages: layoutInfo.totalPages, layout: layoutInfo.layout,
        shotCount: shots.length,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const novelIdForErr = (await episodeModel.findById(episodeId))?.novelId || '';
      logger.error('Comic generation failed', { episodeId, taskId, error: errorMsg });
      // 广播 llm_update 让 UI 显示错误信息
      websocketService.broadcastLlmUpdate(novelIdForErr, {
        phase: 'comic_gen', step: 'error',
        content: `❌ 漫画生成失败: ${errorMsg}`,
        stream: false,
      });
      await taskJobModel.fail(taskId, errorMsg);
      // 关键: 广播 task_update (status='failed') 让前端 WS handler 把 comicGenState 设为 'failed'
      // 不然面板会一直显示 "正在生成漫画"
      websocketService.broadcastTaskUpdate(novelIdForErr, {
        id: taskId, status: 'failed', progress: 20,
      });
    }
  }
}

/**
 * 从 shot.description 中提取"画面:"之后的内容
 * 若没有"画面:"标签则返回 description 全部
 */
function extractVisualFromDescription(desc: string): string {
  // 匹配"画面[:：]\s*(.*?)" 直到下一个标签或结尾
  const match = desc.match(/画面[:：]\s*([\s\S]+?)(?=\n\s*(?:景别|构图|运镜|对白|灯光|色彩|音效|转场|\[image_prompt\]|---)|$)/);
  if (match) return match[1].trim();
  return desc.trim();
}

export const comicService = new ComicService();
