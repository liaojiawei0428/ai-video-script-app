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
  // S72 v3.0.33 P1 #5 修复 (ADR-0002): 取消状态内存 Set → DB 持久化, 重启不丢
  // 双写: 内存 Map 快速路径 (sync boolean, 兼容 9 处调用点), DB fire-and-forget (持久化)
  private static cancelledAtMap = new Map<string, number>();
  // 启动时 fire-and-forget load (从 DB 恢复, 避免重启后 isCancelled 全 false)
  private static loadPromise: Promise<void> | null = null;

  static async startupLoadCancelled(): Promise<void> {
    try {
      const { queryAll } = await import('../models/db');
      const rows = await queryAll<any>('SELECT id, cancelled_at FROM novels WHERE cancelled_at IS NOT NULL');
      for (const r of rows as any[]) NovelService.cancelledAtMap.set(r.id, Number(r.cancelled_at));
      logger.info('Cancelled novels loaded from DB', { count: (rows as any[]).length });
    } catch (e) {
      logger.warn('Failed to load cancelled novels (will retry on first mark)', { err: e instanceof Error ? e.message : String(e) });
    }
  }

  private static ensureLoaded(): void {
    if (!NovelService.loadPromise) {
      NovelService.loadPromise = NovelService.startupLoadCancelled();
    }
  }

  static markCancelled(novelId: string): void {
    NovelService.ensureLoaded();
    NovelService.cancelledAtMap.set(novelId, Date.now());
    // fire-and-forget DB 持久化 (失败不影响内存快速路径, 下次 startup load 会修复)
    import('../models/db').then(({ execute }) => execute('UPDATE novels SET cancelled_at = ? WHERE id = ?', [Date.now(), novelId]))
      .catch(e => logger.warn('markCancelled DB write failed', { novelId, err: e instanceof Error ? e.message : String(e) }));
  }

  static isCancelled(novelId: string): boolean {
    NovelService.ensureLoaded();
    return NovelService.cancelledAtMap.has(novelId);
  }

  static clearCancelled(novelId: string): void {
    NovelService.ensureLoaded();
    NovelService.cancelledAtMap.delete(novelId);
    import('../models/db').then(({ execute }) => execute('UPDATE novels SET cancelled_at = NULL WHERE id = ?', [novelId]))
      .catch(e => logger.warn('clearCancelled DB write failed', { novelId, err: e instanceof Error ? e.message : String(e) }));
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
  /**
   * v3.0.0.40 BUG-105: parseCharactersFromReport 重新设计
   *
   * 之前 (v2.5.14): 解析 37 字段固定格式 (身高/体型/脸型/.../关系), 强制 LLM 填不存在的字段
   *   → 逼 LLM 编造, 跟 user 明确"必须基于剧情内容来描述, 不得乱写"冲突
   * 现在 (v3.0.0.40): 只解析"角色名 + 身份 + 角色类型 + 阵营" 4 个基础字段
   *   description 字段留空, 由后续 extractDescriptions (characterDescription.ts 新版 prompt)
   *   从小说原文 + 全剧摘要生成 Markdown 5 section 自由文本
   *
   * 兼容老 37 字段报告 (历史 novel data): 如果发现 37 字段, 仍按老逻辑解析
   * (容错老数据, 不破坏历史 novel)
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

    // v3.0.0.40 BUG-105: 新格式 "1. 角色名 - 身份 - 角色类型 - 阵营"
    // 例: "1. 独孤琰 - 北燕公主 - 主角 - 正派"
    // 例: "2. 宁风 - 北燕太子 - 重要配角 - 正派"
    // 老 37 字段格式: "1. 角色名 - 身份" 后面接 "   身高:..." 等
    //
    // 判定: 看下一行是不是 "   字段名：值" 形式 → 老格式; 否则 → 新格式
    const newFormatFieldMap: Record<string, string> = {
      '主角': 'protagonist', '重要配角': 'major_supporting', '次要配角': 'minor_supporting',
      '跑龙套': 'extra', '路人': 'passerby', '路人甲乙丙丁': 'passerby',
    };
    const alignmentMap: Record<string, string> = {
      '正派': 'righteous', '反派': 'villain', '中立': 'neutral', '亦正亦邪': 'ambiguous', '无': '',
    };

    // 老 37 字段映射 (保留容错, 老 novel data 不会解析失败)
    const oldFieldMap: Record<string, string> = {
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
    // 探测模式: 第一个角色用哪种格式, 后面跟随
    let detectedFormat: 'new' | 'old' | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 角色名行: "1. 名字 - 身份" / "1、 名字 -"
      // v3.0.0.40: 也匹配 "1. 名字 - 身份 - 主角 - 正派" (新格式)
      const nameMatch = line.match(/^\s*\d+[.、\.]\s*([^\s\-–—(（]+)/);
      if (nameMatch) {
        if (currentChar) parsedChars.push(currentChar);
        const name = nameMatch[1].replace(/[）)]$/, '').trim();

        // v3.0.0.40 BUG-105: 探测格式 — 看下一行是不是老 37 字段
        // 老格式判定: 下一行形如 "   字段名：值"  (字段名前导空白 + 中文标签 + 冒号)
        let isOldFormat = false;
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          for (const label of Object.keys(oldFieldMap)) {
            if (new RegExp(`^\\s+${label}\\s*[：:]`).test(nextLine)) {
              isOldFormat = true;
              break;
            }
          }
        }

        if (detectedFormat === null) {
          detectedFormat = isOldFormat ? 'old' : 'new';
        }

        if (detectedFormat === 'new') {
          // 新格式: "1. 名字 - 身份 - 角色类型 - 阵营"
          // 解析整行, 用 " - " split
          const parts = line.split(/\s*-\s*/);
          const charName = parts[0].replace(/^\s*\d+[.、\.]\s*/, '').trim();
          const identity = parts[1] || '';
          const roleTypeZh = parts[2] || '次要配角';
          const alignmentZh = parts[3] || '中立';

          currentChar = {
            name: charName,
            appearance: '',  // 新版不写, 留给 extractDescriptions
            personality: '',
            roleType: newFormatFieldMap[roleTypeZh] || 'passerby',
            alignment: alignmentMap[alignmentZh] || '',
            description: {
              name: charName,
              identity,        // 身份/职业
              role_type_zh: roleTypeZh,  // 角色类型 (中文, 给新版 characterDescription.ts 参考)
              alignment: alignmentMap[alignmentZh] || '',
            },
          };
        } else {
          // 老 37 字段格式: 容错, 保留原逻辑
          currentChar = {
            name, appearance: '', personality: '', roleType: 'supporting',
            description: { name },
          };
        }
      } else if (currentChar && detectedFormat === 'old') {
        // 老 37 字段解析: "   字段名：值"
        for (const [label, key] of Object.entries(oldFieldMap)) {
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
                                     value.includes('反派') ? 'villain' :
                                     value.includes('龙套') ? 'extra' :
                                     value.includes('路人') ? 'passerby' : 'major_supporting';
              currentChar.alignment = value.includes('反派') ? 'villain' :
                                     value.includes('正派') ? 'righteous' : 'neutral';
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
   * v3.0.0.40 BUG-105: backfill-characters 端点
   *
   * 修法: 不再依赖 parseCharactersFromReport 老 37 字段 (会逼 LLM 编造)
   *   改走 characterService.extractDescriptions → characterDescription.ts 新版 prompt
   *   → 从小说原文 + 全剧摘要生成 Markdown 5 section 自由文本
   *
   * 行为:
   * 1. 从 analysis_report 解析"角色名 + 身份 + 角色类型 + 阵营" 4 基础字段
   * 2. 跟现有角色对比, 增量创建新角色 (不覆盖老角色)
   * 3. 调 extractDescriptions 重生成所有角色 description (走 characterDescription.ts 新版)
   *
   * 配套端点: POST /api/novels/:novelId/backfill-characters (routes/novels.ts:42)
   * 配套前端:
   *   - web: CharacterListPage.tsx 列表页 "重新分析" 按钮
   *   - mobile: CharacterListScreen.tsx 列表页 "重新分析" 按钮
   *   - mobile: CharacterDescriptionReviewScreen.tsx 触发 extractCharacterDescriptions
   */
  async backfillCharactersFromReport(novelId: string): Promise<{ created: number; total: number; alreadyExisted: number; descriptionsGenerated: number }> {
    const novel = await novelModel.findById(novelId);
    if (!novel) throw new AppError('NOVEL_NOT_FOUND', `Novel ${novelId} not found`, 404);
    const report = novel.analysisReport || '';
    if (!report) throw new AppError('NO_ANALYSIS', '小说没有 analysis_report，无法回填', 400);

    // 1. 解析报告 (新格式: 角色名 + 身份 + 角色类型 + 阵营; 老格式 37 字段也容错)
    const parsedChars = NovelService.parseCharactersFromReport(report);
    if (parsedChars.length === 0) {
      logger.warn('backfillCharactersFromReport: 仍未解析到角色', { novelId });
      return { created: 0, total: 0, alreadyExisted: 0, descriptionsGenerated: 0 };
    }

    // 2. 查现有角色，避免重复
    const existing = await characterModel.findByNovelId(novelId);
    const existingNames = new Set(existing.map(c => c.name));
    const toCreate = parsedChars.filter(c => !existingNames.has(c.name));

    let created = 0;
    if (toCreate.length > 0) {
      const characters = toCreate.map(char => ({
        id: generateUUID(), novelId,
        name: char.name, aliases: [],
        appearance: char.appearance, personality: char.personality,
        roleType: char.roleType as any,
        alignment: (char as any).alignment || '',
        relationships: [],
        // v3.0.0.40 BUG-105: 不再存 37 字段 JSON, description 留空 (extractDescriptions 重生成)
        description: '',
        createdAt: Date.now(),
      }));
      await characterModel.bulkCreate(characters);
      created = characters.length;
      logger.info('backfillCharactersFromReport: created', { novelId, created });
    }

    // 3. 同步调 extractDescriptions, 走 characterDescription.ts 新版 prompt
    //   从小说原文 + 全剧摘要生成 Markdown 5 section 自由文本
    let descriptionsGenerated = 0;
    try {
      websocketService.broadcastProgress(novelId, 0, 'character_extracting');
      const { extractDescriptions } = await import('./characterService');
      const descResult = await extractDescriptions(novelId);
      descriptionsGenerated = descResult.succeeded;
      logger.info('backfillCharactersFromReport: descriptions generated (v3.0.0.40 新版 characterDescription.ts)', { novelId, ...descResult });
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

    // S72 v3.0.33 P1 #7 修复 (ADR-0002): 删 multer 写入的原上传文件, 避免磁盘日积月累泄漏
    try { await fs.unlink(filePath); } catch (e) { logger.warn('清理原上传文件失败', { filePath, err: e instanceof Error ? e.message : String(e) }); }

    return novel;
  }

  async analyzeNovel(novelId: string, userId?: string): Promise<TaskJob> {
    const novel = await novelModel.findById(novelId);
    if (!novel) throw new AppError('NOVEL_NOT_FOUND', `Novel ${novelId} not found`, 404);
    if (!novel.filePath) throw new AppError('VALIDATION_ERROR', 'Novel file not available', 400);

    // v2.5.37 P0 #1 修复 (S72 ADR-0002): 防止并发重复任务 + 重复扣费
    // DB 检查替代 taskQueue 内存检查 (taskQueue 重启丢状态, DB 权威)
    const { queryOne } = await import('../models/db');
    const existingActive = await queryOne<{ id: string }>(
      "SELECT id FROM task_jobs WHERE novel_id = ? AND status IN ('queued','running') ORDER BY created_at DESC LIMIT 1",
      [novelId]
    );
    if (existingActive) {
      const existing = await taskJobModel.findById(existingActive.id);
      if (existing) {
        logger.info('analyzeNovel: 已有 active 任务 (DB 检查), 返回现有防重复扣费', { novelId, taskId: existing.id, status: existing.status });
        return existing;
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

    taskQueue.enqueue(novelId, userId || novel.userId || '', task.id, () => this.executeAnalysis(novelId, content, task.id, userId));

    return task;
  }

  private async executeAnalysis(novelId: string, content: string, taskId: string, userId?: string): Promise<void> {
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

        await this.streamAnalysis(novelId, content, taskId, userId);
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
        userId,
      );

      // S72 v3.0.33 P2 #11 修复 (ADR-0002): broadcast 加上 failedChunks 具体段号 (旧版只报 count, 用户不知道哪段失败)
      const failedChunks = summaries.filter(s => s.failed).map(s => s.index);
      if (failedChunks.length > 0) {
        logger.warn('Some chunks failed', { novelId, failedChunks, total: chunks.length });
        websocketService.broadcastLlmUpdate(novelId, {
          phase: 'analyzing', step: 'reasoning',
          content: `⚠️ 第 ${failedChunks.join('、')} 段分析失败 (共 ${failedChunks.length} 段, 已跳过, 不影响整体结果)`,
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

      const fullSummary = await chunkService.mergeSummaries(summaries, novelId, styleBibleBlock, userId);
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
        0.3,
        2,
        userId,
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

      // 🆕 v3.0.38 BUG-103 (2026-06-26): 删除自动退款 (跟 BUG-072 D 长期方案一致)
      //   历史: S72 v3.0.33 P0 #2 修复 (ADR-0002) analyze 失败自动退, 实际 BUG h773052122 退 34.93 元错误
      //   修法: 删 refundStep 调用, 失败只 notifyError 通知 user + admin 人工复核 (跟 BUG-072 D 长期方案一致)
      //   替代: user 联系 admin 微信 → admin 查 billing_logs + task_jobs → 手动 SQL 加余额
      //   配套: billingService.refundStep 整方法删除 (跟 novelService catch 块同步)
      //   notifyError 已有: "请重试或联系客服" 提示 (跟 novelService 现有逻辑一致)

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
  private async streamAnalysis(novelId: string, content: string, taskId: string, userId?: string): Promise<void> {
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
      0.3,
      2,
      userId,
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

    // S72 v3.0.33 P1 #6 修复 (ADR-0002): 角色解析 0 字符时, websocket 推送 fallback 提示
    if (parsedChars.length > 0) {
      const characters = parsedChars.map(char => ({
        id: generateUUID(), novelId,
        name: char.name, aliases: [],
        appearance: char.appearance, personality: char.personality,
        roleType: char.roleType as any,
        alignment: (char as any).alignment || '',
        relationships: [],
        description: JSON.stringify(char.description), // v2.5.14: 保存完整 37 字段描述 JSON
        createdAt: Date.now(),
      }));
      await characterModel.bulkCreate(characters as any);
      logger.info('Characters saved', { novelId, count: characters.length, descFields: Object.keys(characters[0]?.description ? JSON.parse(characters[0].description as any) : {}).length });
    } else {
      logger.warn('No characters parsed from analysis report (regex missed)', { novelId, contentLength: fullContent.length });
      // S72 v3.0.33 P1 #6 fallback: 显式提示用户, 避免 silently failed
      websocketService.broadcastLlmUpdate(novelId, {
        phase: 'character_extracting', step: 'output',
        content: '⚠️ 角色描述未从分析报告解析 (LLM 输出格式可能变了), 可手动调 POST /api/novels/<id>/backfill-characters 重试',
        stream: false,
      });
    }

    // ========== Phase 4: 角色描述生成 (v3.0.0.40 BUG-105 — 永远调新版) ==========
    // v2.5.14 老版本: 报告里 parse 出 37 字段 description 就不再调 extractDescriptions
    //   → characterDescription.ts 新版 prompt 永远不跑
    // v3.0.0.40 新版本: 报告里只列"角色名 + 身份 + 角色类型 + 阵营" 4 个基础字段
    //   → 永远调 extractDescriptions, 走 characterDescription.ts 新版 prompt
    //   → 从小说原文 + 全剧摘要生成 Markdown 5 section 自由文本
    //   → 严禁编造, 丰度梯度按角色标签
    const needsDescExtraction = true;

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
        // S72 v3.0.33 P1 #8 修复 (ADR-0002): 显式推送失败, 避免 silently failed
        websocketService.broadcastLlmUpdate(novelId, {
          phase: 'character_extracting', step: 'output',
          content: `⚠️ 角色详细描述补充失败 (${err instanceof Error ? err.message : String(err)}), 角色可在角色库手动补`,
          stream: false,
        });
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

    // v2.5.36 GAP-1 修复: 自动生成 outline + plotGraph, 失败不阻塞剧集生成
    // 后续可在 OutlinePage / PlotGraphPage 查看/编辑/确认
    // 注: 当前不强制 outline_confirmed 检查 (切集算法两套并存, 留 v2.0.1 统一)
    // S72 v3.0.33 P0 #3 修复 (ADR-0002): 拆 outline/plotGraph 各自 try/catch, 失败标 status='failed' 让 UI 显示
    try {
      const { outlineService } = await import('./outlineService');
      await novelModel.updateFields(novelId, { outlineStatus: 'generating' });
      websocketService.broadcastLlmUpdate(novelId, {
        phase: 'outline_generating', step: 'reasoning',
        content: '📋 正在生成分集大纲...', stream: false,
      });
      const outline = await outlineService.generateOutline(novelId);
      logger.info('Auto-generated outline', { novelId, itemCount: outline.items.length });
      await novelModel.updateFields(novelId, { outlineStatus: 'completed' });
      websocketService.broadcastLlmUpdate(novelId, {
        phase: 'outline_generating', step: 'output',
        content: `✅ 分集大纲已生成 (${outline.items.length} 集), 可在 OutlinePage 查看/编辑/确认`,
        stream: false,
      });
    } catch (err) {
      await novelModel.updateFields(novelId, { outlineStatus: 'failed' }).catch(() => {});
      logger.warn('Auto-generate outline failed (status marked)', {
        novelId, error: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      const { outlineService } = await import('./outlineService');
      await novelModel.updateFields(novelId, { plotGraphStatus: 'generating' });
      websocketService.broadcastLlmUpdate(novelId, {
        phase: 'plot_graph_generating', step: 'reasoning',
        content: '📊 正在生成章节事件图谱...', stream: false,
      });
      const plotGraph = await outlineService.generatePlotGraph(novelId);
      logger.info('Auto-generated plotGraph', { novelId, chapterCount: plotGraph.chapters.length });
      await novelModel.updateFields(novelId, { plotGraphStatus: 'completed' });
      websocketService.broadcastLlmUpdate(novelId, {
        phase: 'plot_graph_generating', step: 'output',
        content: `✅ 章节事件图谱已生成 (${plotGraph.chapters.length} 章), 可在 PlotGraphPage 查看`,
        stream: false,
      });
    } catch (err) {
      await novelModel.updateFields(novelId, { plotGraphStatus: 'failed' }).catch(() => {});
      logger.warn('Auto-generate plotGraph failed (status marked)', {
        novelId, error: err instanceof Error ? err.message : String(err),
      });
    }

    // 分析完成后自动进入剧集生成 (沿用原切集算法, 后续 v2.0.1 统一集数计算)
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

      // 5. 级联删除数据库记录 (v2.5.37 P0 #4 修复 (S72 ADR-0002): 加 billing_logs 删除, 避免孤儿扣费记录)
      await execute('DELETE FROM shots WHERE episode_id IN (SELECT id FROM episodes WHERE novel_id = ?)', [novelId]);
      await execute('DELETE FROM episodes WHERE novel_id = ?', [novelId]);
      await execute('DELETE FROM characters WHERE novel_id = ?', [novelId]);
      await execute('DELETE FROM task_jobs WHERE novel_id = ?', [novelId]);
      await execute('DELETE FROM billing_logs WHERE novel_id = ?', [novelId]);
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
