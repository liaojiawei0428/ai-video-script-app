import { episodeModel } from '../models/episode';
import { novelModel } from '../models/novel';
import { userModel } from '../models/user';
import { billingService } from './billingService';
import { shotModel } from '../models/shot';
import { characterModel } from '../models/character';
import { taskJobModel } from '../models/taskJob';
import { deepseekPool } from './deepseekPool';
import { websocketService } from './websocket';
import { taskQueue } from './taskQueue';
import { generateUUID } from '../shared/utils';
import { Episode, Novel, Scene, PlotPoint, Shot, TaskJob } from '../shared/types';
import { episodeScriptSystemPrompt } from '../prompts/episodeGeneration';
import { shotGenerationSystemPrompt, shotGenerationUserPrompt } from '../prompts/shotGeneration';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { NovelService } from './novelService';
import fs from 'fs/promises';
import iconv from 'iconv-lite';

export class ScriptService {
  async generateEpisodes(
    novelId: string,
    targetDuration: number = 120,
    tolerance: number = 10
  ): Promise<TaskJob> {
    const novel = await novelModel.findById(novelId);
    if (!novel?.filePath) throw new AppError('NOVEL_NOT_FOUND', 'Novel not found or no content', 404);

    if (taskQueue.isQueuedOrRunning(novelId)) {
      const existingTaskId = taskQueue.getExistingTaskId(novelId);
      if (existingTaskId) {
        const existing = await taskJobModel.findById(existingTaskId);
        if (existing) return existing;
      }
    }

    const task: TaskJob = {
      id: generateUUID(),
      novelId,
      type: 'episode_generate',
      status: 'queued',
      progress: 0,
      totalSteps: 5,
      currentStep: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await taskJobModel.create(task);
    await taskJobModel.updateProgress(task.id, 1, 1);
    await novelModel.updateStatus(novelId, 'generating');

    taskQueue.enqueue(novelId, novel.userId || '', task.id, () => this.executeEpisodeGeneration(novel, task.id, targetDuration));

    return task;
  }

  private async executeEpisodeGeneration(
    novel: any, taskId: string, targetDuration: number
  ): Promise<void> {
    const novelId = novel.id;
    try {
      const raw = await fs.readFile(novel.filePath);
      let content = iconv.decode(raw, 'utf-8');
      if (content.includes('\uFFFD')) content = iconv.decode(raw, 'gbk');

      // 准备角色数据 + 全文摘要
      await taskJobModel.updateProgress(taskId, 5, 1);
      websocketService.broadcastProgress(novelId, 5, 'generating');
      const characters = await characterModel.findByNovelId(novelId);
      const fullSummary = novel.fullSummary || '（无全文摘要）';

      // ========== 标准化剧集数计算 ==========
      const MAX_EPISODES = 500;
      const TARGET_SCRIPT_CHARS = 1050;
      const NOVEL_TO_SCRIPT_RATIO = 3.5;
      const CALIBRATION_WINDOW = 5;

      const charsPerEpisode = Math.round(TARGET_SCRIPT_CHARS * NOVEL_TO_SCRIPT_RATIO);
      const totalEpisodes = Math.min(MAX_EPISODES, Math.max(1, Math.ceil(content.length / charsPerEpisode)));
      logger.info('Episode count auto-calculated', { novelId, totalEpisodes, totalChars: content.length, charsPerEpisode, targetScriptChars: TARGET_SCRIPT_CHARS });
      websocketService.broadcastProgress(novelId, 15, 'generating', { totalEpisodes });

      // 删除旧剧集
      await episodeModel.deleteByNovelId(novelId);

      // ========== 分割小说 ==========
      const epSize = Math.ceil(content.length / totalEpisodes);
      const episodePlans: Array<{ episodeNumber: number; title: string; summary: string; startCharIndex: number; endCharIndex: number }> = [];
      let startIdx = 0;
      for (let i = 1; i <= totalEpisodes; i++) {
        let endIdx = Math.min(startIdx + epSize, content.length);
        if (endIdx < content.length && i < totalEpisodes) {
          const searchEnd = Math.min(endIdx + 2000, content.length);
          for (let j = endIdx; j < searchEnd; j++) {
            if (content[j] === '\n' && j + 1 < content.length && content[j + 1] === '\n') {
              endIdx = j; break;
            }
          }
        }
        episodePlans.push({ episodeNumber: i, title: `第${i}集`, summary: `第${i}集（自动分段）`, startCharIndex: startIdx, endCharIndex: endIdx });
        startIdx = endIdx;
      }

      // ========== 自校准统计变量 ==========
      const actualScriptLengths: number[] = [];
      let calibrationDone = false;

      // ========== 逐集生成（每集独立请求，不累积历史） ==========
      await taskJobModel.updateProgress(taskId, 20, 3);
      websocketService.broadcastProgress(novelId, 20, 'generating', { totalEpisodes });

      for (let i = 0; i < episodePlans.length; i++) {
        // 如果小说已被删除，立即停止生成
        if (NovelService.isCancelled(novelId)) {
          logger.info('Episode generation cancelled by user', { novelId, episodeNumber: episodePlans[i].episodeNumber });
          break;
        }
        const plan = episodePlans[i];
        let episodeText = content.slice(plan.startCharIndex, plan.endCharIndex).trim();
        // 文本过短时合并到下一集（不跳过，不断号）
        if (episodeText.length < 50 && i < episodePlans.length - 1) {
          episodePlans[i + 1].startCharIndex = plan.startCharIndex;
          continue;
        }
        if (episodeText.length < 50) continue;

        // 前情提要：上一集末尾 500 字（用于集间衔接）
        let previousEnding = '';
        if (i > 0) {
          const prevPlan = episodePlans[i - 1];
          const prevText = content.slice(prevPlan.startCharIndex, prevPlan.endCharIndex).trim();
          previousEnding = prevText.slice(-500);
        }

        logger.info('Generating episode script (independent request)', {
          novelId, episodeNumber: plan.episodeNumber, totalEpisodes, textLength: episodeText.length,
        });

        const charactersInfo = characters.map(c =>
          `${c.name}（${c.roleType}：${c.appearance || ''} ${c.personality || ''}）`
        ).join('\n');

        // 每集独立构建 prompt
        const episodeReq = `你是专业编剧。请根据以下信息生成第${plan.episodeNumber}/${totalEpisodes}集的剧本。

## 全文概要
${fullSummary}

## 角色设定
${charactersInfo}

## 前情提要
${previousEnding || '（本集为第一集，无前情提要）'}

## 本集小说原文
${episodeText}`;

        const epPhase = `ep_${plan.episodeNumber}`;
        // 通知APP端清空上一集的流式内容（不发送实际内容，避免显示在剧本框）
        websocketService.broadcastLlmUpdate(novelId, {
          phase: epPhase, step: 'reasoning',
          content: '',
          stream: false,
        });

        // 流式调用（独立请求，不复用历史）
        // 每集开始前扣费
        await billingService.chargeStep(novelId, 'episode', episodeText.length);

        let episodeScript = '';
        let streamSucceeded = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            episodeScript = '';
            await deepseekPool.chatCompletionStreamWithMessages(
              [
                { role: 'system', content: episodeScriptSystemPrompt },
                { role: 'user', content: episodeReq },
              ],
              (chunk) => {
                if (NovelService.isCancelled(novelId)) {
                  throw new Error('CANCELLED_BY_USER');
                }
                episodeScript += chunk;
                websocketService.broadcastLlmUpdate(novelId, {
                  phase: epPhase, step: 'output', content: chunk,
                  tokens: episodeScript.length, stream: true,
                });
              },
              0.7
            );
            if (episodeScript.trim().length > 50) {
              streamSucceeded = true;
              break;
            }
            logger.warn('Episode script too short, retrying', {
              novelId, episodeNumber: plan.episodeNumber, attempt, length: episodeScript.length,
            });
          } catch (streamErr) {
            const errMsg = streamErr instanceof Error ? streamErr.message : String(streamErr);
            if (errMsg.includes('CANCELLED_BY_USER')) {
              logger.info('Episode generation cancelled by user', { novelId, episodeNumber: plan.episodeNumber });
              break;
            }
            logger.warn('Episode stream failed, retrying', {
              novelId, episodeNumber: plan.episodeNumber, attempt,
              error: errMsg,
            });
            if (attempt < 3) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
          }
        }

        const scriptText = episodeScript.trim();
        const titleMatch = scriptText.match(/第\d+集[：:](.+)/);
        const episodeTitle = titleMatch ? titleMatch[1].trim() : plan.title;

        // 保存（失败则标记 failed，不中断流程）
        const epStatus: Episode['status'] = streamSucceeded ? 'completed' : 'failed';
        const episode: Episode = {
          id: generateUUID(), novelId, episodeNumber: plan.episodeNumber,
          title: episodeTitle, summary: plan.summary,
          durationSec: targetDuration, sceneLocation: '', characters: [],
          scriptContent: scriptText || '',
          scriptFormat: 'v1', status: epStatus, createdAt: Date.now(),
        };
        await episodeModel.create(episode);

        // ========== 字数校验 + 自校准 ==========
        if (streamSucceeded) {
          const scriptLen = scriptText.length;
          actualScriptLengths.push(scriptLen);
          const deviation = Math.round((scriptLen - TARGET_SCRIPT_CHARS) / TARGET_SCRIPT_CHARS * 100);
          logger.info('Episode script word count', {
            novelId, episodeNumber: plan.episodeNumber, scriptLength: scriptLen,
            target: TARGET_SCRIPT_CHARS, deviation: deviation + '%',
          });

          if (!calibrationDone && actualScriptLengths.length === CALIBRATION_WINDOW && i < totalEpisodes - 1) {
            const avgLen = actualScriptLengths.reduce((a, b) => a + b, 0) / actualScriptLengths.length;
            const deviationRatio = Math.abs(avgLen - TARGET_SCRIPT_CHARS) / TARGET_SCRIPT_CHARS;
            logger.info('Calibration check', {
              novelId, avgScriptLength: Math.round(avgLen), target: TARGET_SCRIPT_CHARS,
              deviationRatio: Math.round(deviationRatio * 100) + '%',
            });

            if (deviationRatio > 0.15) {
              const correctionRatio = TARGET_SCRIPT_CHARS / avgLen;
              const remainingEpisodes = totalEpisodes - (i + 1);
              const remainingStart = episodePlans[i].endCharIndex;
              const remainingContent = content.length - remainingStart;
              const adjustedEpSize = Math.max(500, Math.ceil(remainingContent / remainingEpisodes * correctionRatio));
              logger.info('Calibrating remaining episodes', {
                novelId, correctionRatio: correctionRatio.toFixed(2),
                remainingEpisodes, adjustedEpSize,
              });

              let newStartIdx = remainingStart;
              for (let j = i + 1; j < totalEpisodes; j++) {
                let newEndIdx = Math.min(newStartIdx + adjustedEpSize, content.length);
                if (newEndIdx < content.length && j < totalEpisodes - 1) {
                  const searchEnd = Math.min(newEndIdx + 2000, content.length);
                  for (let k = newEndIdx; k < searchEnd; k++) {
                    if (content[k] === '\n' && k + 1 < content.length && content[k + 1] === '\n') {
                      newEndIdx = k; break;
                    }
                  }
                }
                episodePlans[j] = {
                  episodeNumber: j + 1,
                  title: `第${j + 1}集`,
                  summary: `第${j + 1}集（自动分段）`,
                  startCharIndex: newStartIdx,
                  endCharIndex: newEndIdx,
                };
                newStartIdx = newEndIdx;
              }
              calibrationDone = true;
            } else {
              calibrationDone = true;
            }
          }
        }

        if (!streamSucceeded) {
          logger.error('Episode generation failed after retries', {
            novelId, episodeNumber: plan.episodeNumber,
          });
        }

        const pct = 20 + Math.floor(((i + 1) / totalEpisodes) * 75);
        await taskJobModel.updateProgress(taskId, pct, 3);
        websocketService.broadcastProgress(novelId, pct, 'generating', { totalEpisodes, currentEpisode: i + 1 });
      }

      // ========== 完成（延迟 5 秒确保最后一集流式内容已推送完毕）==========
      await new Promise(r => setTimeout(r, 5000));
      const allEpisodes = await episodeModel.findByNovelId(novelId);
      const failedCount = allEpisodes.filter(e => e.status === 'failed').length;
      await taskJobModel.complete(taskId, { episodeCount: allEpisodes.length, failedCount });
      websocketService.broadcastProgress(novelId, 100, 'completed', {
        totalEpisodes: allEpisodes.length, currentEpisode: allEpisodes.length, failedCount,
      });
      await novelModel.updateStatus(novelId, 'completed');
      try { await userModel.incrementGenerations(novel.userId || ''); } catch {}
      logger.info('Episode generation completed', {
        novelId, taskId, episodeCount: allEpisodes.length, failedCount,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Episode generation failed', { novelId, taskId, error: errorMsg });
      websocketService.broadcastProgress(novelId, 0, 'error');
      await taskJobModel.fail(taskId, errorMsg);
      await novelModel.updateStatus(novelId, 'error');
    }
  }

  async regenerateEpisode(episodeId: string): Promise<TaskJob> {
    const episode = await episodeModel.findById(episodeId);
    if (!episode) throw new AppError('NOVEL_NOT_FOUND', 'Episode not found', 404);
    const novel = await novelModel.findById(episode.novelId);
    if (!novel?.filePath) throw new AppError('NOVEL_NOT_FOUND', 'Novel not found', 404);

    const task: TaskJob = {
      id: generateUUID(),
      novelId: episode.novelId,
      type: 'episode_generate',
      status: 'running',
      progress: 0, totalSteps: 3, currentStep: 0,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    await taskJobModel.create(task);

    // 后台异步执行
    this.executeEpisodeRegeneration(episode, novel, task.id);
    return task;
  }

  private async executeEpisodeRegeneration(
    episode: Episode, novel: any, taskId: string
  ): Promise<void> {
    const novelId = episode.novelId;
    try {
      const raw = await fs.readFile(novel.filePath);
      let content = iconv.decode(raw, 'utf-8');
      if (content.includes('\uFFFD')) content = iconv.decode(raw, 'gbk');

      await taskJobModel.updateProgress(taskId, 10, 1);
      const characters = await characterModel.findByNovelId(novelId);
      const fullSummary = novel.fullSummary || '（无全文摘要）';

      // 计算本集对应段落（与主流程对齐）
      const totalEpisodes = (await episodeModel.findByNovelId(novelId)).length || 1;
      const epSize = Math.ceil(content.length / totalEpisodes);
      const startChar = (episode.episodeNumber - 1) * epSize;
      let endChar = Math.min(startChar + epSize, content.length);
      if (endChar < content.length && episode.episodeNumber < totalEpisodes) {
        const searchEnd = Math.min(endChar + 2000, content.length);
        for (let j = endChar; j < searchEnd; j++) {
          if (content[j] === '\n' && j + 1 < content.length && content[j + 1] === '\n') {
            endChar = j; break;
          }
        }
      }
      const episodeText = content.slice(startChar, endChar).trim();

      // 前情提要
      let previousEnding = '';
      if (episode.episodeNumber > 1) {
        const prevStart = (episode.episodeNumber - 2) * epSize;
        const prevText = content.slice(prevStart, Math.min(prevStart + epSize, content.length)).trim();
        previousEnding = prevText.slice(-500);
      }

      const charactersInfo = characters.map(c =>
        `${c.name}（${c.roleType}：${c.appearance || ''} ${c.personality || ''}）`
      ).join('\n');

      const episodeReq = `（重新生成）你是专业编剧。请根据以下信息生成第${episode.episodeNumber}/${totalEpisodes}集的剧本。

## 全文概要
${fullSummary}

## 角色设定
${charactersInfo}

## 前情提要
${previousEnding || '（本集为第一集）'}

## 本集小说原文
${episodeText}`;

      const epPhase = `regenerate_ep_${episode.episodeNumber}`;
      websocketService.broadcastLlmUpdate(novelId, {
        phase: epPhase, step: 'reasoning',
        content: `🔄 正在重新生成第 ${episode.episodeNumber}/${totalEpisodes} 集...`,
        stream: false,
      });

      await billingService.chargeStep(novelId, 'episode', episodeText.length);

      let scriptText = '';
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          scriptText = '';
          await deepseekPool.chatCompletionStreamWithMessages(
            [
              { role: 'system', content: '【重要】所有对话和输出必须使用中文。你是专业编剧。' },
              { role: 'user', content: episodeReq },
            ],
            (chunk) => {
              if (NovelService.isCancelled(novelId)) {
                throw new Error('CANCELLED_BY_USER');
              }
              scriptText += chunk;
              websocketService.broadcastLlmUpdate(novelId, {
                phase: epPhase, step: 'output', content: chunk,
                tokens: scriptText.length, stream: true,
              });
            },
            0.7
          );
          if (scriptText.trim().length > 50) break;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg.includes('CANCELLED_BY_USER')) {
            logger.info('Regeneration cancelled by user', { novelId, episodeId: episode.id });
            break;
          }
          logger.warn('Regeneration attempt failed', {
            episodeId: episode.id, attempt,
            error: errMsg,
          });
          if (attempt < 3) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }

      scriptText = scriptText.trim();
      const titleMatch = scriptText.match(/第\d+集[：:](.+)/);
      const episodeTitle = titleMatch ? titleMatch[1].trim() : episode.title;

      // 覆盖保存
      const newStatus: Episode['status'] = scriptText.length > 50 ? 'completed' : 'failed';
      await episodeModel.update(episode.id, {
        title: episodeTitle,
        scriptContent: scriptText || episode.scriptContent,
        status: newStatus,
      });

      await taskJobModel.complete(taskId, { regenerated: true, status: episode.status });
      websocketService.broadcastLlmUpdate(novelId, {
        phase: epPhase, step: 'output',
        content: episode.status === 'completed' ? '✅ 重新生成完成' : '⚠️ 重新生成失败',
        stream: false,
      });

      logger.info('Episode regeneration completed', {
        episodeId: episode.id, status: episode.status, textLength: scriptText.length,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Episode regeneration failed', { episodeId: episode.id, taskId, error: errorMsg });
      await taskJobModel.fail(taskId, errorMsg);
    }
  }

  async generateShots(episodeId: string): Promise<TaskJob> {
    const episode = await episodeModel.findById(episodeId);
    if (!episode) throw new AppError('NOVEL_NOT_FOUND', 'Episode not found', 404);

    if (taskQueue.isQueuedOrRunning(episode.novelId)) {
      const existingTaskId = taskQueue.getExistingTaskId(episode.novelId);
      if (existingTaskId) {
        const existing = await taskJobModel.findById(existingTaskId);
        if (existing) return existing;
      }
    }

    const task: TaskJob = {
      id: generateUUID(),
      novelId: episode.novelId,
      type: 'shot_generate',
      status: 'queued',
      progress: 0,
      totalSteps: 2,
      currentStep: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await taskJobModel.create(task);

    taskQueue.enqueue(episode.novelId, '', task.id, () => this.executeShotGeneration(episodeId, task.id));

    return task;
  }

  private async executeShotGeneration(episodeId: string, taskId: string): Promise<void> {
    try {
      const episode = await episodeModel.findById(episodeId);
      if (!episode) throw new Error('Episode not found');
      const characters = await characterModel.findByNovelId(episode.novelId);

      await taskJobModel.updateProgress(taskId, 50, 1);
      logger.info('Generating shots', { episodeId, taskId });

      // 广播开始提示
      websocketService.broadcastLlmUpdate(episode.novelId, {
        phase: 'shot_gen', step: 'reasoning',
        content: '🎬 AI 正在生成镜头分析...（实时输出中）',
        stream: false,
      });

      await billingService.chargeStep(episode.novelId, 'shot');

      // 使用流式 API 逐 token 推送分镜头内容
      let shotContent = '';
      try {
        await deepseekPool.chatCompletionStreamWithRetry(
          shotGenerationSystemPrompt,
          shotGenerationUserPrompt(episode.scriptContent, JSON.stringify(characters), JSON.stringify({ location: episode.sceneLocation })),
          (chunk) => {
            if (NovelService.isCancelled(episode.novelId)) {
              throw new Error('CANCELLED_BY_USER');
            }
            shotContent += chunk;
            websocketService.broadcastLlmUpdate(episode.novelId, {
              phase: 'shot_gen', step: 'output',
              content: chunk,
              tokens: shotContent.length,
              stream: true,
            });
          },
          0.7
        );
      } catch (streamErr) {
        logger.error('Shot generation stream failed', { episodeId, taskId, error: streamErr });
        // 如果流式失败但已经有部分内容，尝试解析
        if (!shotContent) throw streamErr;
      }

      // 调试：记录 AI 返回的前 500 字符
      logger.info('Shot AI response preview', {
        episodeId, taskId, preview: shotContent.slice(0, 500),
      });

      // AI 返回自然文本格式，直接保存为单条描述
      const rawText = shotContent.trim();
      logger.info('Shot generation completed, saving raw text', {
        episodeId, taskId, contentLength: rawText.length,
        preview: rawText.slice(0, 200),
      });

      // 按 --- 分割成多条镜头，每条保存为一个 shot
      const segments = rawText.split(/---+/).filter(s => s.trim().length > 0);
      const shots: Shot[] = segments.length > 0 ? segments.map((seg, index) => {
        const durationMatch = seg.match(/镜头\d+\s*\|\s*(\d+(?:\.\d+)?)\s*秒/);
        const durationSec = durationMatch ? parseFloat(durationMatch[1]) : 5;
        return {
          id: generateUUID(), episodeId, shotNumber: index + 1,
          sceneType: seg.includes('EXT') ? 'EXT' : 'INT',
          location: episode.sceneLocation || '',
          timeOfDay: seg.includes('夜') ? '夜' : '日',
          description: seg.trim().slice(0, 30000),
          cameraAngle: '', cameraMove: '', lighting: '',
          durationSec, audioNote: '', dialogue: '', action: '',
          status: 'completed' as const,
        };
      }) : [{
        id: generateUUID(), episodeId, shotNumber: 1,
        sceneType: 'INT', location: episode.sceneLocation || '',
        timeOfDay: '日', description: rawText.slice(0, 30000),
        cameraAngle: '', cameraMove: '', lighting: '',
        durationSec: 5, audioNote: '', dialogue: '', action: '',
        status: 'completed' as const,
      }];

      // 先删除旧的分镜头，再保存新的
      const { execute } = await import('../models/db');
      await execute('DELETE FROM shots WHERE episode_id = ?', [episodeId]);
      await shotModel.bulkCreate(shots);
      await taskJobModel.complete(taskId, { shotCount: shots.length });
      logger.info('Shots generation completed', { episodeId, taskId, shotCount: shots.length });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Shot generation failed', { episodeId, taskId, error: errorMsg });
      await taskJobModel.fail(taskId, errorMsg);
    }
  }
}

export const scriptService = new ScriptService();
