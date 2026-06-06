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
import { buildStyleBible, StylePresetId, StyleBible, buildStyleAnchorPrefix, buildVoiceAndToneBlock, buildStyleBibleJsonBlock } from '../services/styleBible';
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

  /**
   * v2.5.10 公开：从 analysis_report 文本中解析角色列表
   * 兼容 4 种区段头: "🎭 角色分析：" / "🎭 分析：" / "角色分析：" / "分析："
   * 兼容 LLM 偶尔漏冒号: "外貌 " / "性格 " / "类型 "
   */
  /**
   * v2.5.14: 从分析报告中解析角色详细描述 (37 字段格式)
   * 返回值包含完整的 description JSON, 不再只是 appearance/personality 简单字段
   */
  static parseCharactersFromReport(fullContent: string): Array<{
    name: string; appearance: string; personality: string; roleType: string;
    description: Record<string, any>;
  }> {
    let roleSection = fullContent.match(/🎭[^\n]*?角色分析[：:]([\s\S]*?)(?=📜|$)/);
    if (!roleSection) roleSection = fullContent.match(/🎭[^\n]*?分析[：:]([\s\S]*?)(?=📜|$)/);
    if (!roleSection) roleSection = fullContent.match(/角色分析[：:]([\s\S]*?)(?=\n\n|\n📜|$)/);
    if (!roleSection) roleSection = fullContent.match(/^分析[：:]\s*([\s\S]*?)(?=\n\n|\n📜|$)/m);

    const parsedChars: Array<{ name: string; appearance: string; personality: string; roleType: string; description: Record<string, any> }> = [];
    if (!roleSection) return parsedChars;

    // 字段映射: 中文标签 → JSON key
    const fieldMap: Record<string, string> = {
      '类型': 'role_type', '性别': 'gender', '年龄': 'age', '身高': 'height',
      '体型': 'build', '脸型': 'face', '肤色': 'skin',
      '眼睛': 'eyes', '眉毛': 'eyebrows', '鼻子': 'nose', '嘴唇': 'lips',
      '发色': 'hair_color', '发型': 'hair_style', '发长': 'hair_length', '发饰': 'hair_accessories',
      '上衣': 'clothing_top', '下装': 'clothing_bottom', '外套': 'clothing_outer', '鞋子': 'clothing_shoes',
      '颈饰': 'accessories_neck', '耳饰': 'accessories_ears', '手饰': 'accessories_hands',
      '腰饰': 'accessories_waist', '其他配饰': 'accessories_other',
      '随身道具': 'props', '显著特征': 'distinctive_features', '妆容': 'makeup',
      '默认表情': 'default_expression', '情绪范围': 'emotional_range', '肢体语言': 'body_language',
      '性格视觉化': 'personality_visual', '阶层视觉化': 'social_class_visual',
      '外貌': '_appearance', '性格': '_personality', '关系': '_relationships',
    };

    const lines = roleSection[1].split('\n');
    let currentChar: any = null;

    for (const line of lines) {
      // 角色名行: "1. 名字 - 身份" / "1、 名字 -"
      const nameMatch = line.match(/^\s*\d+[.、\.]\s*([^\s\-–—(（]+)/);
      if (nameMatch) {
        if (currentChar) parsedChars.push(currentChar);
        const name = nameMatch[1].replace(/[）)]$/, '').trim();
        currentChar = {
          name, appearance: '', personality: '', roleType: 'supporting',
          description: { name },
        };
      } else if (currentChar) {
        // 解析每个字段: "   字段名：值"
        for (const [label, key] of Object.entries(fieldMap)) {
          const regex = new RegExp(`^\\s*${label}\\s*[：:]?\\s*(.+)`);
          const match = line.match(regex);
          if (match) {
            const value = match[1].trim();
            if (key === '_appearance') {
              currentChar.appearance = value;
            } else if (key === '_personality') {
              currentChar.personality = value;
            } else if (key === 'role_type') {
              currentChar.roleType = value.includes('主角') ? 'protagonist' :
                                     value.includes('反派') ? 'antagonist' :
                                     value.includes('龙套') ? 'minor' : 'supporting';
              currentChar.description.role_type = currentChar.roleType;
            } else {
              currentChar.description[key] = value;
            }
            break;
          }
        }
      }
    }
    if (currentChar) parsedChars.push(currentChar);
    return parsedChars;
  }

  /**
   * v2.5.10: 回填 - 从已有 analysis_report 重新解析并创建角色（不重跑 LLM）
   * 用于修复历史 novel（如 33ca8e0a）的角色库为空问题
   */
  async backfillCharactersFromReport(novelId: string): Promise<{ created: number; total: number; alreadyExisted: number; descriptionsGenerated: number }> {
    const novel = await novelModel.findById(novelId);
    if (!novel) throw new AppError('NOVEL_NOT_FOUND', `Novel ${novelId} not found`, 404);
    const report = novel.analysisReport || '';
    if (!report) throw new AppError('NO_ANALYSIS', '小说没有 analysis_report，无法回填', 400);

    const parsedChars = NovelService.parseCharactersFromReport(report);
    if (parsedChars.length === 0) {
      logger.warn('backfillCharactersFromReport: 仍未解析到角色', { novelId });
      return { created: 0, total: 0, alreadyExisted: 0, descriptionsGenerated: 0 };
    }

    // 查现有角色，避免重复
    const existing = await characterModel.findByNovelId(novelId);
    const existingNames = new Set(existing.map(c => c.name));
    const toCreate = parsedChars.filter(c => !existingNames.has(c.name));

    let created = 0;
    if (toCreate.length > 0) {
      const characters = toCreate.map(char => ({
        id: generateUUID(), novelId,
        name: char.name, aliases: [],
        appearance: char.appearance, personality: char.personality,
        roleType: char.roleType as 'protagonist' | 'antagonist' | 'supporting' | 'minor', relationships: [],
        createdAt: Date.now(),
      }));
      await characterModel.bulkCreate(characters);
      created = characters.length;
      logger.info('backfillCharactersFromReport: created', { novelId, created });
    }

    // v2.5.14: 同步调用 extractDescriptions, 从小说原文生成详细描述
    // 之前是 setImmediate 异步, 用户看不到结果
    let descriptionsGenerated = 0;
    try {
      websocketService.broadcastProgress(novelId, 0, 'character_extracting');
      const { extractDescriptions } = await import('./characterService');
      const descResult = await extractDescriptions(novelId);
      descriptionsGenerated = descResult.succeeded;
      logger.info('backfillCharactersFromReport: descriptions generated', { novelId, ...descResult });
    } catch (err) {
      logger.warn('backfill extractDescriptions failed', { novelId, error: err instanceof Error ? err.message : String(err) });
    }

    return { created, total: parsedChars.length, alreadyExisted: existing.length, descriptionsGenerated };
  }

  async createNovel(
    title: string,
    author: string,
    filePath: string,
    userId?: string,
    styleId?: string
  ): Promise<Novel> {
    const { content, title: parsedTitle } = await fileParserService.parseFile(filePath);

    const novelDir = path.join(config.uploadDir, 'novels');
    await fs.mkdir(novelDir, { recursive: true });

    const novelFilePath = path.join(novelDir, `${generateUUID()}.txt`);
    await fs.writeFile(novelFilePath, content, 'utf-8');

    // v2.5.9: 生成 styleBible（风格圣经）——全剧所有生成的不可变风格锚点
    const styleBible = buildStyleBible(((styleId as any) || 'realistic') as StylePresetId);

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
      // v2.0.0
      styleId: (styleId as any) || 'realistic',
      // v2.5.9: 风格圣经（自动生成，所有生成流必须引用）
      styleBible: styleBible as any,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await novelModel.create(novel);
    logger.info('Novel created', {
      novelId: novel.id, title: novel.title, totalChars: novel.totalChars,
      styleId: novel.styleId, styleBibleVersion: styleBible.version,
    });

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

      // 余额守门检查
      await billingService.guardBalance(novelId, taskId, 'analyze', content.length);
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
      const novelForStyle = await novelModel.findById(novelId);
      const styleBibleBlock = novelForStyle?.styleBible ? buildStyleAnchorPrefix(novelForStyle.styleBible as any, 'zh') : undefined;
      const summaries = await chunkService.analyzeAllChunks(
        chunks,
        novelId,
        (progress: ChunkProgress) => {
          websocketService.broadcastChunkProgress(novelId, progress);
        },
        styleBibleBlock,
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

      const fullSummary = await chunkService.mergeSummaries(summaries, novelId, styleBibleBlock);
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
      const novelRecord = await novelModel.findById(novelId);
      const styleBibleJson = novelRecord?.styleBible ? buildStyleBibleJsonBlock(novelRecord.styleBible as any) : undefined;
      await deepseekPool.chatCompletionStreamWithRetry(
        novelAnalysisSystemPrompt,
        novelAnalysisUserPrompt(fullSummary, styleBibleJson),
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

      // v2.5.15: 创建系统通知
      try {
        const novel = await novelModel.findById(novelId);
        if (novel?.userId) {
          const { notifyError } = await import('./notify');
          await notifyError(novel.userId, '小说分析失败',
            `《${novel.title || '未知小说'}》分析失败：${errorMsg.slice(0, 200)}\n请重试或联系客服。`, novelId);
        }
      } catch {}
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

    const parsedChars = NovelService.parseCharactersFromReport(fullContent);

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
        roleType: char.roleType as 'protagonist' | 'antagonist' | 'supporting' | 'minor',
        relationships: [],
        description: JSON.stringify(char.description), // v2.5.14: 保存完整 37 字段描述 JSON
        createdAt: Date.now(),
      }));
      await characterModel.bulkCreate(characters as any);
      logger.info('Characters saved', { novelId, count: characters.length, descFields: Object.keys(characters[0]?.description ? JSON.parse(characters[0].description as any) : {}).length });
    } else {
      logger.warn('No characters parsed from analysis report (regex missed)', { novelId, contentLength: fullContent.length });
    }

    // ========== Phase 4: 角色描述补充 (v2.5.14 — 仅当分析报告未生成详细描述时才调用) ==========
    // 新版分析 prompt 已在报告中生成 37 字段详细描述, 不需要再单独调 extractDescriptions
    // 但旧版报告(简单格式)没有详细描述, 需要补充
    const needsDescExtraction = parsedChars.some(c => !c.description || Object.keys(c.description).length <= 2);

    if (needsDescExtraction) {
      await taskJobModel.updateProgress(taskId, 90, 3);
      websocketService.broadcastProgress(novelId, 90, 'analyzing');
      websocketService.broadcastLlmUpdate(novelId, {
        phase: 'analyzing', step: 'reasoning',
        content: '🎭 正在根据小说原文补充角色详细描述...',
      });

      try {
        const { extractDescriptions } = await import('./characterService');
        const descResult = await extractDescriptions(novelId);

        for (const char of descResult.characters) {
          if (char.description) {
            websocketService.broadcastLlmUpdate(novelId, {
              phase: 'character_extracting', step: 'output',
              content: `✅ ${char.name}: 描述已生成`,
              stream: false,
            });
          }
        }

        websocketService.broadcastLlmUpdate(novelId, {
          phase: 'character_extracting', step: 'output',
          content: `🎭 角色描述补充完成: ${descResult.succeeded}/${descResult.total} 个角色`,
          stream: false,
        });
        logger.info('Character descriptions supplemented', { novelId, ...descResult });
      } catch (err) {
        logger.warn('Character description supplementation failed', { novelId, error: err instanceof Error ? err.message : String(err) });
      }
    } else {
      logger.info('Characters already have detailed descriptions from analysis, skipping extractDescriptions', { novelId });
      websocketService.broadcastLlmUpdate(novelId, {
        phase: 'character_extracting', step: 'output',
        content: `🎭 角色详细描述已从分析报告中提取 (${parsedChars.length} 个角色)`,
        stream: false,
      });
    }

    await taskJobModel.updateProgress(taskId, 100, 3);
    websocketService.broadcastProgress(novelId, 100, 'analyzed');
    await taskJobModel.complete(taskId, { genre: saveGenre, theme, style, tone, characterCount: parsedChars.length });
    await novelModel.updateStatus(novelId, 'analyzed');

    try {
      const novel = await novelModel.findById(novelId);
      if (novel?.userId) await userModel.incrementGenerations(novel.userId);
    } catch {}

    logger.info('Novel analysis completed', { novelId, taskId });

    // 分析完成后自动进入剧集生成
    try {
      const scriptService = (await import('./scriptService')).scriptService;
      await scriptService.generateEpisodes(novelId);
      logger.info('Auto-triggered episode generation after analysis', { novelId });
    } catch (err) {
      logger.warn('Failed to auto-trigger episode generation', { novelId, error: err instanceof Error ? err.message : String(err) });
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

    // 1. 标记取消，让正在运行的后台任务停止 AI 调用（不清除标记，保持永久取消状态）
    NovelService.markCancelled(novelId);
    taskQueue.cancel(novelId);

    // 2. 通知客户端任务已终止
    websocketService.broadcastProgress(novelId, 0, 'error', { detail: '小说已被删除，任务已终止' });

    try {
      // 3. 取消所有正在运行的 task_job
      const { execute, queryAll } = await import('../models/db');
      const runningTasks = await queryAll<any>(
        "SELECT id FROM task_jobs WHERE novel_id = ? AND status IN ('running','queued')",
        [novelId]
      );
      for (const t of runningTasks) {
        await taskJobModel.cancel(t.id);
      }

      // 4. 删除上传文件
      if (novel.filePath) {
        try {
          await fs.unlink(novel.filePath);
        } catch {
          logger.warn('Failed to delete novel file', { filePath: novel.filePath });
        }
      }

      // 5. 级联删除数据库记录
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
