import { episodeModel } from '../models/episode';
import { novelModel } from '../models/novel';
import { userModel } from '../models/user';
import { billingService } from './billingService';
import { shotModel } from '../models/shot';
import { characterModel } from '../models/character';
import { taskJobModel } from '../models/taskJob';
import { deepseekPool } from './deepseekPool';
import { imageProvider } from './imageProvider';
import { websocketService } from './websocket';
import { taskQueue } from './taskQueue';
import { generateUUID } from '../shared/utils';
import { Episode, Novel, Scene, PlotPoint, Shot, TaskJob } from '../shared/types';
import { episodeScriptSystemPrompt } from '../prompts/episodeGeneration';
import { shotGenerationSystemPrompt, shotGenerationUserPrompt } from '../prompts/shotGeneration';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { NovelService } from './novelService';
import { buildStyleAnchorPrefix, buildVoiceAndToneBlock, buildStyleBibleJsonBlock, buildStyleNegativePrompt } from './styleBible';
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

    // 只在已有"episode_generate"任务时复用，否则允许排队
    if (taskQueue.isQueuedOrRunning(novelId)) {
      const existingTaskId = taskQueue.getExistingTaskId(novelId);
      if (existingTaskId) {
        const existing = await taskJobModel.findById(existingTaskId);
        if (existing && existing.type === 'episode_generate') return existing;
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

    taskQueue.enqueue(novelId, novel.userId || '', task.id, () => this.executeEpisodeGeneration(novel, task.id, targetDuration), 'episode_generate');

    return task;
  }

  /**
   * 继续生成：从已有 N 集继续生成后续集
   * 适用于：余额不足中断后充值、用户主动中断后恢复
   */
  async continueEpisodeGeneration(
    novelId: string,
    targetDuration: number = 120
  ): Promise<TaskJob> {
    const novel = await novelModel.findById(novelId);
    if (!novel?.filePath) throw new AppError('NOVEL_NOT_FOUND', 'Novel not found or no content', 404);

    if (taskQueue.isQueuedOrRunning(novelId)) {
      const existingTaskId = taskQueue.getExistingTaskId(novelId);
      if (existingTaskId) {
        const existing = await taskJobModel.findById(existingTaskId);
        if (existing && existing.type === 'episode_generate') return existing;
      }
    }

    // 找到已生成的集数
    const existingEps = await episodeModel.findByNovelId(novelId);
    const existingNumbers = new Set(existingEps.map(e => e.episodeNumber));
    logger.info('Continue episode generation', { novelId, existingCount: existingEps.length, existingNumbers: [...existingNumbers] });

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

    taskQueue.enqueue(
      novelId, novel.userId || '', task.id,
      () => this.executeEpisodeGeneration(novel, task.id, targetDuration, existingNumbers),
      'episode_generate'
    );

    return task;
  }

  private async executeEpisodeGeneration(
    novel: any, taskId: string, targetDuration: number, skipNumbers: Set<number> = new Set()
  ): Promise<void> {
    const novelId = novel.id;
    try {
      const raw = await fs.readFile(novel.filePath);
      let content = iconv.decode(raw, 'utf-8');
      if (content.includes('\uFFFD')) content = iconv.decode(raw, 'gbk');

      await taskJobModel.updateProgress(taskId, 5, 1);
      websocketService.broadcastProgress(novelId, 5, 'generating');
      const characters = await characterModel.findByNovelId(novelId);
      const fullSummary = novel.fullSummary || '（无全文摘要）';
      const charactersInfo = characters.map(c =>
        `${c.name}（${c.roleType}：${c.appearance || ''} ${c.personality || ''}）`
      ).join('\n');

      // ========== 1. AI 分析剧集数 + 剧情大阶段 ==========
      const MAX_EPISODES = 500;
      const TARGET_SCRIPT_CHARS = 1050;
      const CALIBRATION_WINDOW = 5;

      const formulaEpisodes = Math.min(MAX_EPISODES, Math.max(1, Math.ceil(content.length / (Math.round(TARGET_SCRIPT_CHARS * 3.5)))));

      websocketService.broadcastLlmUpdate(novelId, {
        phase: 'episode_plan', step: 'reasoning',
        content: '🤖 AI 正在分析小说结构，规划剧集数量...',
        stream: false,
      });
      websocketService.broadcastProgress(novelId, 7, 'generating', { detail: 'AI 正在分析剧集数...' });

      let totalEpisodes = formulaEpisodes;
      let storyArcs: Array<{ epRange: string; name: string }> = [];
      try {
        const planResult = await this.aiEpisodePlan(novel, fullSummary, charactersInfo, content.length, formulaEpisodes);
        if (planResult.episodes >= 1 && planResult.episodes <= MAX_EPISODES) {
          totalEpisodes = planResult.episodes;
        }
        if (planResult.arcs && planResult.arcs.length > 0) {
          storyArcs = planResult.arcs;
        }
        logger.info('AI episode plan', { novelId, episodes: totalEpisodes, arcs: storyArcs.length });
      } catch (e) {
        logger.warn('AI episode plan failed, using formula', { novelId, error: e instanceof Error ? e.message : String(e) });
      }

      const arcSummary = storyArcs.length > 0
        ? storyArcs.map(a => `  ${a.epRange}: ${a.name}`).join('\n')
        : '';
      websocketService.broadcastLlmUpdate(novelId, {
        phase: 'episode_plan', step: 'output',
        content: `📺 剧集分为 ${totalEpisodes} 集${arcSummary ? '\n\n📋 剧情阶段：\n' + arcSummary : ''}`,
        stream: false,
      });
      websocketService.broadcastProgress(novelId, 15, 'generating', { totalEpisodes, detail: `剧集分为 ${totalEpisodes} 集` });

      // 删除旧剧集（仅当不是续集时）
      if (skipNumbers.size === 0) {
        await episodeModel.deleteByNovelId(novelId);
      } else {
        logger.info('Resume: preserving existing episodes', { novelId, preservedCount: skipNumbers.size });
      }

      // ========== 2. 语义切分 + 构建分集计划 ==========
      websocketService.broadcastLlmUpdate(novelId, {
        phase: 'episode_plan', step: 'reasoning',
        content: '🔍 正在按场景语义切分剧集边界...',
        stream: false,
      });
      websocketService.broadcastProgress(novelId, 17, 'generating', { detail: '正在切分剧集...' });

      // 将小说按段落分割并编号
      const paragraphs = this.splitParagraphs(content);
      const { episodesBoundaries, episodePlans } = await this.buildEpisodePlans(
        novelId, content, paragraphs, totalEpisodes, storyArcs
      );

      logger.info('Episode plans built', { novelId, totalEpisodes, boundariesFromAI: episodesBoundaries });

      // ========== 滚动状态卡 ==========
      let characterStates = '';
      let unresolvedHooks = '';
      let rollingPlotSummary = ''; // ★ 新增：滚动剧情摘要（每3集压缩一次）
      const actualScriptLengths: number[] = [];
      let calibrationDone = false;

      // ========== 3. 逐集生成 ==========
      await taskJobModel.updateProgress(taskId, 20, 3);
      websocketService.broadcastProgress(novelId, 20, 'generating', { totalEpisodes });

      // 一次性获取角色名列表（用于 updateCharacterStatesSync，避免每集重复查DB）
      const characterNameList = (await characterModel.findByNovelId(novelId)).map(c => c.name);
      const epStartTime = Date.now();
      let prevScriptEnding = ''; // ★ 新增：上一集生成的剧本结尾（关键！保证剧情连贯）
      const COMPRESS_INTERVAL = 3; // 每3集压缩一次滚动摘要
      const recentScriptEndings: string[] = []; // 用于每3集生成滚动摘要
      for (let i = 0; i < episodePlans.length; i++) {
        if (NovelService.isCancelled(novelId)) {
          logger.info('Episode generation cancelled', { novelId, episodeNumber: episodePlans[i].episodeNumber });
          break;
        }
        const plan = episodePlans[i];

        // ★ 跳过已生成的集 (用于 resume/continue)
        if (skipNumbers.has(plan.episodeNumber)) {
          logger.info('Skipping already-generated episode', { novelId, ep: plan.episodeNumber });
          // 仍然需要预热 prevScriptEnding 和 recentScriptEndings
          // 从 DB 读已生成的剧本
          const existing = await episodeModel.findByNovelId(novelId);
          const exist = existing.find(e => e.episodeNumber === plan.episodeNumber);
          if (exist) {
            prevScriptEnding = exist.scriptContent.slice(-300);
            if (exist.scriptContent.length > 50) {
              characterStates = this.updateCharacterStatesSync(characterNameList, exist.scriptContent, characterStates);
              recentScriptEndings.push(exist.scriptContent.slice(-200));
            }
          }
          // 更新进度
          const pct = 20 + Math.floor(((i + 1) / totalEpisodes) * 75);
          await taskJobModel.updateProgress(taskId, pct, 3);
          websocketService.broadcastProgress(novelId, pct, 'generating', { totalEpisodes, currentEpisode: i + 1, detail: `已恢复 ${i + 1}/${totalEpisodes} 集` });
          continue;
        }

        const epLoopStart = Date.now();
        let episodeText = content.slice(plan.startCharIndex, plan.endCharIndex).trim();
        if (episodeText.length < 50 && i < episodePlans.length - 1) {
          episodePlans[i + 1].startCharIndex = plan.startCharIndex;
          continue;
        }
        if (episodeText.length < 50) continue;

        // 前情提要 (来自上一集生成的剧本，而非小说原文！保证剧情连贯)
        let previousEnding = prevScriptEnding;

        // 当前剧情阶段
        const currentArc = storyArcs.find(a => {
          const [start, end] = a.epRange.split('-').map(Number);
          return plan.episodeNumber >= start && (end ? plan.episodeNumber <= end : true);
        });

        // 构建滚动状态卡
        const stateCard = this.buildStateCard({
          fullSummary, charactersInfo, characterStates, unresolvedHooks,
          previousEnding, currentArc: currentArc?.name || '', totalEpisodes,
          episodeNumber: plan.episodeNumber, rollingPlotSummary,
        });

        const llmStart = Date.now();
        logger.info('Generating episode', {
          novelId, ep: plan.episodeNumber, textLen: episodeText.length,
          stateLen: stateCard.length, arc: currentArc?.name,
        });

        const epPhase = `ep_${plan.episodeNumber}`;

        // 发送"开始思考"消息，含当前集号
        websocketService.broadcastLlmUpdate(novelId, {
          phase: epPhase, step: 'thinking',
          content: `🧠 正在构思第${plan.episodeNumber}集...`,
          stream: false,
        });
        websocketService.broadcastProgress(novelId,
          20 + Math.floor((i / totalEpisodes) * 75),
          'generating', { totalEpisodes, currentEpisode: i, detail: `构思第${plan.episodeNumber}/${totalEpisodes}集` });

        // 每集 prompt = 状态卡 + 原文段落 + 风格圣经
        const voiceAndTone = (novel as any)?.styleBible ? buildVoiceAndToneBlock((novel as any).styleBible) : '';
        const styleBibleBlock = (novel as any)?.styleBible ? buildStyleAnchorPrefix((novel as any).styleBible, 'zh') : undefined;
        const episodeReq = `你是专业编剧。请根据以下信息生成第${plan.episodeNumber}/${totalEpisodes}集的剧本。

⚠️ 重要约束：
- 必须承接"前情提要"中的剧情, 不要让已发生的事件反转
- 不要引入"前情提要"和"角色设定"中未出现的新角色
- 保持与"角色当前状态"一致(情感、位置、关系)
- 严格基于"本集小说原文"改编, 不要凭空添加原著没有的内容
- 必须严格遵守"风格圣经"中的语言风格, 不可因为场景/角色变化而改变文风

${voiceAndTone ? `\n## 风格圣经 - 剧本/对白风格指南(不可违反)\n${voiceAndTone}\n` : ''}

${stateCard}

## 本集小说原文
${episodeText}`;

        websocketService.broadcastLlmUpdate(novelId, {
          phase: epPhase, step: 'reasoning',
          content: '',
          stream: false,
        });

        await billingService.guardBalance(novelId, taskId, 'episode', episodeText.length);
        await billingService.chargeStep(novelId, 'episode', episodeText.length);

        const { scriptText, streamSucceeded } = await this.generateEpisodeStream(novelId, epPhase, episodeReq, styleBibleBlock, voiceAndTone);
        const llmDurationMs = Date.now() - llmStart;

        const titleMatch = scriptText.match(/第\d+集[：:](.+)/);
        const episodeTitle = titleMatch ? titleMatch[1].trim() : plan.title;

        const epStatus: Episode['status'] = streamSucceeded ? 'completed' : 'failed';
        const episode: Episode = {
          id: generateUUID(), novelId, episodeNumber: plan.episodeNumber,
          title: episodeTitle, summary: plan.summary,
          durationSec: targetDuration, sceneLocation: '', characters: [],
          scriptContent: scriptText || '',
          scriptFormat: 'v1', status: epStatus, createdAt: Date.now(),
        };
        await episodeModel.create(episode);

        // 更新状态卡 (非阻塞 - 不再 await 等待下一次生成)
        if (streamSucceeded) {
          characterStates = this.updateCharacterStatesSync(characterNameList, scriptText, characterStates);
          unresolvedHooks = this.extractUnresolvedHooks(scriptText, unresolvedHooks);
          actualScriptLengths.push(scriptText.length);

          // ★ 关键：记录上一集剧本结尾，给下一集 LLM 看（保证剧情连贯！）
          prevScriptEnding = scriptText.slice(-300);

          // ★ 关键：每3集压缩一次滚动剧情摘要，给后续集 LLM 看（长距离记忆）
          recentScriptEndings.push(scriptText.slice(-200));
          if (recentScriptEndings.length >= COMPRESS_INTERVAL) {
            try {
              rollingPlotSummary = await this.summarizeRecentScripts(
                recentScriptEndings.slice(-COMPRESS_INTERVAL),
                plan.episodeNumber, novelId
              );
            } catch (e) {
              logger.warn('Rolling summary failed, using simple concat', { novelId, error: e instanceof Error ? e.message : String(e) });
              rollingPlotSummary = recentScriptEndings.slice(-COMPRESS_INTERVAL)
                .map((s, idx) => `[近${COMPRESS_INTERVAL - idx}集尾] ${s.slice(-80)}`)
                .join('\n');
            }
          }
        }

        const pct = 20 + Math.floor(((i + 1) / totalEpisodes) * 75);
        await taskJobModel.updateProgress(taskId, pct, 3);
        websocketService.broadcastProgress(novelId, pct, 'generating', { totalEpisodes, currentEpisode: i + 1 });
        const epLoopDurationMs = Date.now() - epLoopStart;
        logger.info('Episode done', {
          novelId, ep: plan.episodeNumber,
          llmMs: llmDurationMs, totalMs: epLoopDurationMs,
          scriptLen: scriptText.length, charsPerSec: scriptText.length > 0 ? Math.round(scriptText.length / (llmDurationMs / 1000)) : 0,
        });
      }

      await new Promise(r => setTimeout(r, 5000));
      const allEpisodes = await episodeModel.findByNovelId(novelId);
      const failedCount = allEpisodes.filter(e => e.status === 'failed').length;
      await taskJobModel.complete(taskId, { episodeCount: allEpisodes.length, failedCount });
      websocketService.broadcastProgress(novelId, 100, 'completed', {
        totalEpisodes: allEpisodes.length, currentEpisode: allEpisodes.length, failedCount,
      });
      await novelModel.updateStatus(novelId, 'completed');
      try { await userModel.incrementGenerations(novel.userId || ''); } catch {}
      logger.info('Episode generation completed', { novelId, taskId, episodeCount: allEpisodes.length, failedCount });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Episode generation failed', { novelId, taskId, error: errorMsg });
      websocketService.broadcastProgress(novelId, 0, 'error');
      await taskJobModel.fail(taskId, errorMsg);
      await novelModel.updateStatus(novelId, 'error');
    }
  }

  // ========== 智能分集辅助方法 ==========

  /** 按段落分割小说（保留自然断点） */
  private splitParagraphs(content: string): string[] {
    const paragraphs: string[] = [];
    let current = '';
    for (let i = 0; i < content.length; i++) {
      current += content[i];
      if (content[i] === '\n' && content[i + 1] === '\n') {
        const trimmed = current.trim();
        if (trimmed.length > 10) paragraphs.push(trimmed);
        current = '';
        i++;
      }
    }
    const remaining = current.trim();
    if (remaining.length > 10) paragraphs.push(remaining);
    return paragraphs;
  }

  /** 从 ID 列表中找语义切分点（LumberChunker 风格） */
  private async findSemanticBoundary(paragraphs: string[], fromIdx: number, windowSize: number = 15): Promise<number | null> {
    const endIdx = Math.min(fromIdx + windowSize, paragraphs.length);
    const idsText = paragraphs.slice(fromIdx, endIdx)
      .map((p, i) => `ID:${fromIdx + i}\n${p.slice(0, 200)}`)
      .join('\n\n');

    const prompt = `你是叙事分析专家。被编号的段落属于同一篇小说的连续段落。
找出第一个内容发生明显变化的段落ID（场景切换/时间跳跃/视角转换/新事件）。
不要选第一段。只返回一个ID编号。

${idsText}

最适合切分的ID：`;

    try {
      const result = await deepseekPool.chatCompletionWithMessages([
        { role: 'system', content: '你是叙事分析专家。只返回"ID:数字"格式。' },
        { role: 'user', content: prompt },
      ], 0.2);
      const match = result.content.match(/(\d+)/);
      if (match) {
        const boundary = parseInt(match[1], 10);
        if (boundary > fromIdx && boundary < endIdx) return boundary;
      }
    } catch {}
    return null;
  }

  /** AI 剧集规划：返回集数+剧情大阶段 */
  private async aiEpisodePlan(
    novel: any, summary: string, charactersInfo: string, totalChars: number, formulaEstimate: number
  ): Promise<{ episodes: number; arcs: Array<{ epRange: string; name: string }> }> {
    const wordCountWan = (totalChars / 10000).toFixed(1);
    const prompt = `你是影视编剧。已知小说信息如下：

书名：${novel.title || '未命名'}
总字数：${wordCountWan} 万字（约 ${totalChars} 字符）
全文概要：${summary || '（无）'}
角色列表：${charactersInfo || '（无）'}
公式预估：${formulaEstimate} 集

请分析后给出：
1. 合理的总集数（短篇<5万字:5-15集，中篇5-20万:15-50集，长篇20-50万:50-120集，超长篇>50万:100-300集）
2. 每10集左右的剧情大阶段划分（用集数区间+阶段名描述主线发展阶段）

仅输出JSON，不要任何解释：
{"episodes":36,"arcs":[{"epRange":"1-10","name":"入宫篇"},{"epRange":"11-20","name":"争宠篇"},{"epRange":"21-30","name":"翻盘篇"},{"epRange":"31-36","name":"终局篇"}]}`;

    const result = await deepseekPool.chatCompletionWithMessages([
      { role: 'system', content: '你是影视编剧。只输出JSON，不要任何解释。' },
      { role: 'user', content: prompt },
    ], 0.3);

    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const episodes = Math.min(500, Math.max(1, parseInt(String(parsed.episodes), 10) || formulaEstimate));
        const arcs = Array.isArray(parsed.arcs) ? parsed.arcs.filter((a: any) => a.epRange && a.name) : [];
        return { episodes, arcs };
      }
    } catch {}

    const numMatch = result.content.match(/(\d+)/);
    return { episodes: numMatch ? Math.min(500, Math.max(1, parseInt(numMatch[1], 10))) : formulaEstimate, arcs: [] };
  }

  /** 构建分集计划（公式预估边界 + 语义微调） */
  private async buildEpisodePlans(
    novelId: string, content: string, paragraphs: string[],
    totalEpisodes: number, storyArcs: Array<{ epRange: string; name: string }>
  ): Promise<{
    episodesBoundaries: number;
    episodePlans: Array<{ episodeNumber: number; title: string; summary: string; startCharIndex: number; endCharIndex: number }>;
  }> {
    const epPlans: Array<{ episodeNumber: number; title: string; summary: string; startCharIndex: number; endCharIndex: number }> = [];

    // 公式预估每集覆盖的字符数
    const charsPerEp = Math.ceil(content.length / totalEpisodes);
    let startIdx = 0;

    for (let ep = 1; ep <= totalEpisodes; ep++) {
      // 公式预估终点
      let endIdx = Math.min(startIdx + charsPerEp, content.length);

      // 在预估终点附近找语义切分点（±2000字符窗口内搜双换行）
      if (ep < totalEpisodes && endIdx < content.length - 100) {
        const searchStart = Math.max(startIdx + Math.floor(charsPerEp * 0.7), endIdx - 2000);
        const searchEnd = Math.min(endIdx + 2000, content.length);
        let bestBreak = endIdx;

        // 优先找双换行（段落边界）
        for (let j = endIdx; j < searchEnd - 1; j++) {
          if (content[j] === '\n' && content[j + 1] === '\n') {
            bestBreak = j;
            break;
          }
        }
        if (bestBreak === endIdx) {
          // 退而找单换行
          for (let j = endIdx; j < searchEnd; j++) {
            if (content[j] === '\n') { bestBreak = j; break; }
          }
        }

        // 如果窗口内有足够段落，尝试 AI 语义切分
        const paraSubset = paragraphs.filter((_, pi) => {
          const pStart = content.indexOf(paragraphs[pi]?.slice(0, 50) || '', Math.max(0, searchStart - 100));
          return pStart >= 0 && pStart < searchEnd;
        });
        if (paraSubset.length >= 5 && ep < totalEpisodes) {
          try {
            const boundary = await this.findSemanticBoundary(paraSubset, 0, Math.min(15, paraSubset.length));
            if (boundary && boundary > 1 && boundary < paraSubset.length - 1) {
              const boundaryText = paraSubset[boundary]?.slice(0, 50) || '';
              const bIdx = content.indexOf(boundaryText, searchStart);
              if (bIdx > startIdx + Math.floor(charsPerEp * 0.5) && bIdx < content.length - 100) {
                bestBreak = bIdx;
                logger.info('AI semantic boundary', { novelId, ep, bestBreak });
              }
            }
          } catch {}
        }

        endIdx = bestBreak;
      }

      if (ep === totalEpisodes) endIdx = content.length;

      const currentArc = storyArcs.find(a => {
        const [s, e] = a.epRange.split('-').map(Number);
        return ep >= s && (e ? ep <= e : true);
      });

      epPlans.push({
        episodeNumber: ep,
        title: currentArc ? `${currentArc.name} ${ep}` : `第${ep}集`,
        summary: currentArc ? `${currentArc.name} · ${ep}/${totalEpisodes}集` : `第${ep}集`,
        startCharIndex: startIdx,
        endCharIndex: endIdx,
      });

      startIdx = endIdx;
      if (startIdx >= content.length) break;
    }

    return { episodesBoundaries: epPlans.length, episodePlans: epPlans };
  }

  /** 生成单集剧本流 */
  private async generateEpisodeStream(
    novelId: string, epPhase: string, episodeReq: string,
    styleBibleBlock?: string, voiceAndTone?: string,
  ): Promise<{ scriptText: string; streamSucceeded: boolean }> {
    let scriptText = '';
    let streamSucceeded = false;
    const startTime = Date.now();
    let firstChunkTime = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        scriptText = '';
        await deepseekPool.chatCompletionStreamWithMessages(
          [
            { role: 'system', content: episodeScriptSystemPrompt(styleBibleBlock, voiceAndTone) },
            { role: 'user', content: episodeReq },
          ],
          (chunk) => {
            if (NovelService.isCancelled(novelId)) throw new Error('CANCELLED_BY_USER');
            if (!firstChunkTime) firstChunkTime = Date.now() - startTime;
            scriptText += chunk;
            websocketService.broadcastLlmUpdate(novelId, {
              phase: epPhase, step: 'output', content: chunk,
              tokens: scriptText.length, stream: true,
            });
          },
          0.7
        );
        if (scriptText.trim().length > 50) {
          streamSucceeded = true;
          logger.info('Episode stream done', {
            novelId, epPhase,
            firstChunkMs: firstChunkTime,
            totalMs: Date.now() - startTime,
            scriptLen: scriptText.length,
          });
          break;
        }
      } catch (e: any) {
        if (e.message?.includes('CANCELLED_BY_USER')) break;
        if (attempt < 3) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
    return { scriptText: scriptText.trim(), streamSucceeded };
  }

  /** 构建滚动状态卡 */
  private buildStateCard(params: {
    fullSummary: string; charactersInfo: string; characterStates: string;
    unresolvedHooks: string; previousEnding: string; currentArc: string;
    totalEpisodes: number; episodeNumber: number; rollingPlotSummary?: string;
  }): string {
    const { fullSummary, charactersInfo, characterStates, unresolvedHooks, previousEnding, currentArc, totalEpisodes, episodeNumber, rollingPlotSummary } = params;

    // 关键优化：限制状态卡总大小，防止后续集越来越慢
    const fullSummaryCapped = fullSummary.slice(0, 400);
    const charactersInfoCapped = charactersInfo.slice(0, 300);
    const characterStatesCapped = (characterStates || '').slice(-300);
    const unresolvedHooksCapped = (unresolvedHooks || '').slice(-200);
    const rollingPlotSummaryCapped = (rollingPlotSummary || '').slice(-400);

    const parts: string[] = ['## 全文概要', fullSummaryCapped];

    if (currentArc) {
      parts.push('## 当前阶段', `${currentArc}（第${episodeNumber}/${totalEpisodes}集）`);
    }

    parts.push('## 角色设定', charactersInfoCapped);

    if (characterStatesCapped) {
      parts.push('## 角色当前状态（前集结束时）', characterStatesCapped);
    }

    if (rollingPlotSummaryCapped) {
      parts.push('## 近几集剧情回顾（保证长距离连贯）', rollingPlotSummaryCapped);
    }

    if (unresolvedHooksCapped) {
      parts.push('## 未解决伏笔', unresolvedHooksCapped);
    }

    if (previousEnding) {
      parts.push('## 前情提要（上集结尾剧本）', previousEnding);
    }

    return parts.join('\n\n');
  }

  /** 从已生成的剧本中提取角色状态变化 */
  private updateCharacterStatesSync(charNames: string[], scriptText: string, currentStates: string): string {
    // 快速扫描（无 LLM 调用，无 DB 调用）：从剧本末尾提取角色出现情况
    const ending = scriptText.slice(-800);
    const presentChars = charNames.filter(n => ending.includes(n));
    if (presentChars.length === 0) return currentStates;
    const lines: string[] = currentStates ? currentStates.split('\n').filter(Boolean) : [];
    lines.push(presentChars.join('/') + ' 在场');
    // 限制最多保留 5 行（防止状态卡膨胀）
    return lines.slice(-5).join('\n');
  }

  /** 提取未解决伏笔 */
  private extractUnresolvedHooks(scriptText: string, existing: string): string {
    // 在剧本中搜索悬念/开放式结尾标记
    const hooks: string[] = [];
    const lines = scriptText.split('\n');
    for (let i = Math.max(0, lines.length - 15); i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('？') || line.includes('悬念') || line.includes('伏笔') ||
          line.includes('未完') || line.includes('待续') || line.includes('究竟')) {
        hooks.push(line.trim());
      }
    }
    if (hooks.length > 0) return hooks.slice(0, 3).join(' | ');
    return existing;
  }

  /**
   * P1: 压缩最近 N 集剧本结尾为短摘要 (滚动剧情摘要)
   * 用于注入后续 LLM 调用，保证长距离剧情连贯
   */
  private async summarizeRecentScripts(
    endings: string[],
    currentEp: number,
    novelId: string
  ): Promise<string> {
    const joined = endings.map((e, i) => `[${currentEp - endings.length + i + 1}集尾] ${e}`).join('\n');
    const prompt = `请将以下剧本结尾片段压缩为 300 字内的"近几集剧情回顾"，保留关键人物状态、情感变化、剧情走向、悬念。不要解释，直接输出压缩结果。\n\n${joined}`;

    let summary = '';
    try {
      await deepseekPool.chatCompletionStreamWithMessages(
        [
          { role: 'system', content: '你是剧情摘要助手。只输出压缩后的剧情文本，不超过300字。' },
          { role: 'user', content: prompt },
        ],
        (chunk) => { summary += chunk; },
        0.3
      );
      return summary.trim().slice(0, 500);
    } catch (e) {
      logger.warn('Rolling summary LLM failed, using simple concat', { novelId, error: e instanceof Error ? e.message : String(e) });
      return endings.map((s, i) => `[${currentEp - endings.length + i + 1}集] ${s.slice(-80)}`).join('; ');
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

      const voiceAndTone = (novel as any)?.styleBible ? buildVoiceAndToneBlock((novel as any).styleBible) : '';
      const styleBibleBlock = (novel as any)?.styleBible ? buildStyleAnchorPrefix((novel as any).styleBible, 'zh') : undefined;
      const episodeReq = `（重新生成）你是专业编剧。请根据以下信息生成第${episode.episodeNumber}/${totalEpisodes}集的剧本。

${voiceAndTone ? `## 风格圣经 - 剧本/对白风格指南（不可违反）\n${voiceAndTone}\n\n` : ''}## 全文概要
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

      await billingService.guardBalance(novelId, taskId, 'episode', episodeText.length);
      await billingService.chargeStep(novelId, 'episode', episodeText.length);

      let scriptText = '';
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          scriptText = '';
          await deepseekPool.chatCompletionStreamWithMessages(
            [
              { role: 'system', content: episodeScriptSystemPrompt(styleBibleBlock, voiceAndTone) },
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
      const novel = await novelModel.findById(episode.novelId);
      const styleBibleBlock = (novel as any)?.styleBible ? buildStyleAnchorPrefix((novel as any).styleBible, 'zh') : undefined;
      const voiceAndTone = (novel as any)?.styleBible ? buildVoiceAndToneBlock((novel as any).styleBible) : undefined;

      await taskJobModel.updateProgress(taskId, 50, 1);
      logger.info('Generating shots', { episodeId, taskId });

      // 广播开始提示
      websocketService.broadcastLlmUpdate(episode.novelId, {
        phase: 'shot_gen', step: 'reasoning',
        content: '🎬 AI 正在生成镜头分析...（实时输出中）',
        stream: false,
      });

      await billingService.guardBalance(episode.novelId, taskId, 'shot');
      await billingService.chargeStep(episode.novelId, 'shot');

      // 使用流式 API 逐 token 推送分镜头内容
      let shotContent = '';
      try {
        await deepseekPool.chatCompletionStreamWithRetry(
          shotGenerationSystemPrompt(styleBibleBlock, voiceAndTone),
          shotGenerationUserPrompt(episode.scriptContent, JSON.stringify(characters), JSON.stringify({ location: episode.sceneLocation }), styleBibleBlock, voiceAndTone),
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

      // v2.0.0: 异步触发镜头生图 (不阻塞主流程, 失败也不影响)
      setImmediate(() => this.generateShotImagesAsync(episode, shots, characters));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Shot generation failed', { episodeId, taskId, error: errorMsg });
      await taskJobModel.fail(taskId, errorMsg);
    }
  }

  // v2.0.0: 镜头生图 (SVG 占位, 异步, 不阻塞, 失败静默)
  private async generateShotImagesAsync(episode: any, shots: any[], characters: any[]): Promise<void> {
    try {
      const novel = await novelModel.findById(episode.novelId);
      const styleId = (novel as any)?.styleId || 'realistic';
      const charMap = new Map(characters.map(c => [c.name, c]));

      let generated = 0;
      for (const shot of shots) {
        try {
          // 推断涉及角色: 找对话/描述里出现的前 2 个角色
          const involvedNames: string[] = [];
          for (const c of characters) {
            if ((shot.description || '').includes(c.name) || (shot.dialogue || '').includes(c.name)) {
              involvedNames.push(c.name);
              if (involvedNames.length >= 2) break;
            }
          }
          const involvedChars = involvedNames
            .map(n => charMap.get(n))
            .filter(Boolean)
            .map(c => ({ id: c.id, name: c.name, description: c.description, styleId: c.styleId }));
          const involvedIds = involvedChars.map(c => c.id);

          const imagePrompt = `${shot.description || ''} ${shot.cameraAngle || ''} ${shot.lighting || ''}`.trim();
          // 增强 prompt: 把涉及角色的描述拼上
          const charDescSnippet = involvedChars
            .map(c => (c as any).description ? ` (${c.name}: ${(c as any).description.slice(0, 100)})` : ` (${c.name})`)
            .join('');
          const finalPrompt = imagePrompt + charDescSnippet;

          const result = await imageProvider.generate({
            prompt: finalPrompt || 'cinematic shot',
            styleId: (styleId as any),
            width: 512,
            height: 320,
            angle: 'full_body' as any,
            seed: Date.now() + shot.shotNumber,
          });

          await shotModel.update(shot.id, {
            imageUrl: result.url,
            imagePrompt: finalPrompt,
            imageGeneratedAt: Date.now(),
            characterIds: involvedIds,
            styleId,
          } as any);

          generated++;
          if (generated % 3 === 0) {
            websocketService.broadcastLlmUpdate(episode.novelId, {
              phase: 'shot_image',
              step: 'progress',
              content: `🎨 已为 ${generated}/${shots.length} 个镜头生成参考图...`,
              stream: false,
            });
          }
        } catch (e) {
          logger.warn('Single shot image gen failed', { shotId: shot.id, error: (e as Error).message });
        }
      }
      logger.info('Shot images generation done', { episodeId: episode.id, generated, total: shots.length });
      websocketService.broadcastLlmUpdate(episode.novelId, {
        phase: 'shot_image',
        step: 'done',
        content: `🎨 ${generated}/${shots.length} 个镜头已生成参考图`,
        stream: false,
      });
    } catch (e) {
      logger.warn('generateShotImagesAsync failed', { error: (e as Error).message });
    }
  }
}

export const scriptService = new ScriptService();
