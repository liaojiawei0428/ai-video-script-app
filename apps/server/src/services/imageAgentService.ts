// apps/server/src/services/imageAgentService.ts
// v3.0.0.16+: 生图 Agent 服务 — 极简 passthrough (用户原文即英文 prompt, 无 LLM 提取/翻译步骤)
// v3.0.24 (S61 v3): 加 LLM prompt 优化层 (复用 video system prompt + isStoryboardScript 检测)
// 详细设计: docs/V3_AGENT_MATRIX.md §5
// 状态机: idle → awaiting_clarification (欢迎语) → plan_ready (processTurn 直接出) → tool_queued → tool_executing → tool_completed

// v3.0.0.13+: 极简 passthrough 模式, 不再调 LLM 提取/翻译
// v3.0.24 (S61 v3): 加 agnesTextProvider LLM 优化 (通用 + 分镜检测), 复用 video 的 system prompt
import { imageProvider, rateLimitedGenerate } from './imageProvider';
import { agnesTextProvider } from './agnesTextProvider';
import { imageConversationModel, imageGenerationModel } from '../models/imageConversation';
import { billingService, isVipActive, IMAGE_DAILY_QUOTA_STANDARD, IMAGE_DAILY_QUOTA_VIP } from './billingService';
import { userModel } from '../models/user';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { extractErrorMessage } from '../utils/errorUtils';
import { generateUUID } from '../shared/utils';
import { AgentMessage, AgentPart, AgentConversationStatus, PlanData } from '../shared/types';
import { parseAspectRatioFromText, parseAspectToDims } from '../prompts/imageAspectRatio';
import { PlanFields } from '../prompts/imagePlanFields';
import { buildFinalEnglishPrompt } from '../prompts/imagePromptBuilder';
import { buildVideoPromptOptimizerMessages, buildStoryboardOptimizerMessages, isStoryboardScript } from '../prompts/videoAgentSystem';

// ── 计费 ──
// v3.0.0.31 (S51): 生图免费 (0 元/张), 改用日限额 (普通 30/天, VIP 无限)
// 原 CHARGING_T2I=0.01 / I2I=0.02 / MULTI_REF=0.02 全部废弃
// v3.0.24 (S61 v3): prompt LLM 优化 ¥0.01/次 (复用 video 同款机制)
const DEFAULT_IMG_DIM: [number, number] = [1024, 1024];
const IMG_PROMPT_LLM_TIMEOUT_MS = 30_000;
const IMG_PROMPT_LLM_COST = 0.01;
const IMG_PROMPT_LLM_MIN_OUTPUT = 5;

// ── 异步任务锁 (P0 fix: 重复 confirm 触发多条 background 链) ──
// Map<conversationId, Promise<void>> — 跟踪进行中的 background 任务
// acquire(): 新 confirm 看到已有锁 → 拒绝
// release(): background 完成时 (finally) 清掉
// v3.0.0.32 (S54): file-scope, 跨实例共享同一进程所有 confirm 入口
const imageBackgroundLocks = new Map<string, Promise<void>>();

// ═══════════════════════════════════════════════════════════════
// 类型 & helpers
// ═══════════════════════════════════════════════════════════════

export interface ImageAgentProcessResult {
  conversationId: string;
  aiMessage: AgentMessage;
  status: AgentConversationStatus;
}

function parseMessages(raw: any): AgentMessage[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(raw) ? raw : [];
}

// v3.0.0.27 (S47): 在最后一个带 plan part 的 assistant message 后追加 { type: 'streaming', stage } part
function pushStreamingProgress(messages: AgentMessage[], stage = 'generating'): AgentMessage[] {
  const result = [...messages];
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].role !== 'assistant') continue;
    const hasPlan = result[i].parts.some(p => p.type === 'plan');
    if (hasPlan) {
      result[i] = { ...result[i], parts: [...result[i].parts, { type: 'streaming', stage } as unknown as AgentPart] };
      return result;
    }
  }
  return result;
}

// v3.0.0.27 (S47): 替换最后 assistant message 的 streaming part → newPart (image / error)
function replaceStreamingPart(messages: AgentMessage[], newPart: AgentPart): AgentMessage[] {
  const result = [...messages];
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].role !== 'assistant') continue;
    const hasStreaming = result[i].parts.some(p => (p as any).type === 'streaming');
    if (hasStreaming) {
      result[i] = { ...result[i], parts: result[i].parts.map(p => (p as any).type === 'streaming' ? newPart : p) };
      return result;
    }
  }
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].role !== 'assistant') continue;
    const hasPlan = result[i].parts.some(p => p.type === 'plan');
    if (hasPlan) {
      result[i] = { ...result[i], parts: [...result[i].parts, newPart] };
      return result;
    }
  }
  result.push({
    id: generateUUID(),
    role: 'assistant',
    parts: [newPart],
    createdAt: Date.now(),
  });
  return result;
}

function parsePlan(raw: any): PlanData | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

function parsePlanFields(raw: any): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw && typeof raw === 'object' ? raw : {};
}

function partsToText(parts: AgentPart[]): string {
  return parts.map(p => {
    if (p.type === 'text') return p.text;
    if (p.type === 'image') {
      // v3.0.0.16: reference image 已被抽到 refImageUrls, 不再拼到 prompt (避免污染生图大模型)
      if ((p as any).role === 'reference') return '';
      return `[图片: ${p.url}]`;
    }
    if (p.type === 'plan') return `[方案: ${p.data.prompt}]`;
    if (p.type === 'question') return `[问题: ${p.data.question}]`;
    return '';
  }).filter(Boolean).join('\n');
}

// v3.0.0.31 (S51): 生图统一免费, 返回 0 (audit + 日限额逻辑)
// 注: S51 改免费 + 日限额后, 这个函数仅作占位保留 (confirm 调用一次, 写入 image_generations.charged_amount=0)
//      计划 v3.1.0 删除, 届时 confirm 直接 hardcode 0
function estimateCharging(mode: string, hasRef: boolean): number {
  return 0;
}

function refImageUrlsFromParts(parts: AgentPart[]): string[] {
  return parts
    .filter(p => p.type === 'image' && (p as any).role === 'reference')
    .map(p => (p as any).url)
    .filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════
// ImageAgentService
// ═══════════════════════════════════════════════════════════════

export class ImageAgentService {

  /** 创建新会话 */
  async createConversation(userId: string): Promise<{ conversationId: string; welcome: AgentMessage }> {
    const conversationId = await imageConversationModel.create({ userId, mode: 'text2img' });
    const welcome: AgentMessage = {
      id: generateUUID(),
      role: 'assistant',
      parts: [{
        type: 'text',
        text: '你好, 我是生图助手 ✨\n我需要问你几个关键问题, 然后帮你整理一套标准生图方案。\n\n请告诉我: 你想生成什么? (主体/场景/风格随便说)',
      }],
      createdAt: Date.now(),
    };
    const messages = [welcome];
    await imageConversationModel.update(conversationId, {
      messages,
      plan: null,
      planFields: {},
      status: 'awaiting_clarification' as AgentConversationStatus,
    } as any);
    return { conversationId, welcome };
  }

  /** 处理一轮用户输入 — 极简 passthrough
   * v3.0.0.13: 删 LLM 提取字段/多轮问答, 用户发什么原文就 plan_cn_ready
   *   - 第一次: enPrompt = 用户原文 + 末尾 quality tags
   *   - modification (i2i): 沿用 i2i prompt 策略, confirm 阶段附加 last_result_url
   *   - aspectRatio: 优先 client 传的, 缺省 1024x1024
   */
  async processTurn(conversationId: string, userInputParts: AgentPart[], aspectRatioFromClient?: string): Promise<ImageAgentProcessResult> {
    const conv = await imageConversationModel.findById(conversationId);
    if (!conv) throw new Error(`会话不存在: ${conversationId}`);
    if (conv.user_id === undefined) throw new Error('会话无 user_id');

    // 状态检查: 允许 awaiting_clarification / plan_cn_ready / plan_ready / tool_completed
    // v3.0.32 (BUG-081 S71 后置): 加 plan_ready. 之前 S70 v3.0.0.16+ 改 passthrough 模式后, processTurn
    // 直接跳 plan_ready (跳过 plan_cn_ready), 但 allowedStates 没更新 → 用户改方案时 throw
    // raw Error → errorHandler 兜底 'An unexpected error occurred' 500 → 客户端 '无法更改方案'
    // 实际: plan_ready 是正常可改方案状态, 必允许
    const allowedStates = ['awaiting_clarification', 'plan_cn_ready', 'plan_ready', 'tool_completed'];
    if (!allowedStates.includes(conv.status)) {
      throw new AppError(
        'INVALID_CONVERSATION_STATE',
        `当前状态 ${conv.status} 不可对话, 需 awaiting_clarification / plan_cn_ready / plan_ready / tool_completed`,
        400,
        { currentStatus: conv.status, allowedStates }
      );
    }

    const messages = parseMessages(conv.messages);
    const existingFields = parsePlanFields(conv.plan_fields);

    // v3.0.0.4: 检测是否是 modification (用户基于上次生成的图提修改)
    const isModification = conv.status === 'tool_completed' && !!conv.last_result_url;
    const lastResultUrl = conv.last_result_url || null;

    // 1. 构造 user AgentMessage
    const userMessage: AgentMessage = {
      id: generateUUID(),
      role: 'user',
      parts: userInputParts,
      createdAt: Date.now(),
    };
    messages.push(userMessage);

    const refUrls = refImageUrlsFromParts(userInputParts);
    const refUrlsAccum = refImageUrlsFromParts(
      messages.filter(m => m.role === 'user').flatMap(m => m.parts)
    );

    // 2. v3.0.0.13: 不再调 LLM, 拿用户原文作为 plan_cn_ready 的基础
    // v3.0.24 (S61 v3): 加 LLM 优化层 (复用 video system prompt + 分镜检测), 失败/超时 fallback passthrough
    const userTextRaw = partsToText(userInputParts);
    let enPromptBase = userTextRaw;
    let promptOptimized = false;
    let promptOptimizedMode: 'generic' | 'storyboard' | null = null;
    if (userTextRaw && userTextRaw.length >= 3 && !isModification) {
      const isStoryboard = isStoryboardScript(userTextRaw);
      const messages = isStoryboard
        ? buildStoryboardOptimizerMessages(userTextRaw)
        : buildVideoPromptOptimizerMessages(userTextRaw);
      promptOptimizedMode = isStoryboard ? 'storyboard' : 'generic';
      const t0 = Date.now();
      try {
        const llmPromise = agnesTextProvider.chatCompletion({
          messages,
          temperature: isStoryboard ? 0.5 : 0.7,
          maxTokens: isStoryboard ? 1500 : 800,
          enableThinking: false,
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('image-prompt-llm-timeout')), IMG_PROMPT_LLM_TIMEOUT_MS)
        );
        const llmResult = await Promise.race([llmPromise, timeoutPromise]);
        const llmOutput = (llmResult?.content || '').trim();
        if (llmOutput.length >= IMG_PROMPT_LLM_MIN_OUTPUT) {
          enPromptBase = llmOutput;
          promptOptimized = true;
          try {
            await billingService.chargeImage(
              conv.user_id,
              IMG_PROMPT_LLM_COST,
              isStoryboard ? 'image prompt LLM 优化(分镜)' : 'image prompt LLM 优化',
              conversationId,
              'prompt_optimize',
              isStoryboard ? '图片 prompt LLM 优化(分镜)' : '图片 prompt LLM 优化'
            );
          } catch (chargeErr) {
            logger.warn('ImageAgent: prompt optimize charge failed (non-blocking)', {
              conversationId, error: (chargeErr as Error).message,
            });
          }
          logger.info('ImageAgent: prompt optimized by LLM', {
            conversationId,
            mode: promptOptimizedMode,
            originalLen: userTextRaw.length,
            optimizedLen: llmOutput.length,
            elapsedMs: Date.now() - t0,
            usage: llmResult.usage,
          });
        } else {
          logger.warn('ImageAgent: LLM output too short, fallback to original', {
            conversationId, mode: promptOptimizedMode, outputLen: llmOutput.length,
          });
        }
      } catch (llmErr) {
        logger.warn('ImageAgent: LLM prompt optimization failed, fallback to passthrough', {
          conversationId, mode: promptOptimizedMode, error: (llmErr as Error).message,
        });
      }
    }
    // 移除比例后缀 (兼容老调用) — 如果包含 "比例换成" 之类的关键词, parse 出来
    const aspectRatioParsed = parseAspectRatioFromText(userTextRaw);
    let finalAspectRatio = aspectRatioFromClient || aspectRatioParsed || (conv.plan as any)?.aspectRatio || '1024x1024';
    // v3.0.0.18 (audit #12): 文字比例 (9:16/16:9 等) 兜底成 WxH, 跟 video 保持一致
    const dimsFromText = parseAspectToDims(finalAspectRatio);
    if (dimsFromText) finalAspectRatio = `${dimsFromText[0]}x${dimsFromText[1]}`;

    // 3. 直接 plan_cn_ready (不再多轮问答)
    const newPlanFields = { ...existingFields, subject: enPromptBase || '' };

    // 4. 构造 AI 消息 (极简, 无字段表格, 无 scene badge)
    //    注: text part 是 v3.0.0 极简模式的 UI 兜底文案 (前端 AgentChatPanel 也基于 status 流式卡片显示,
    //        text 是 DB 持久化兜底 + 历史会话回顾用). 详见 docs/V3_AGENT_MATRIX.md §5
    const baseText = isModification
      ? '✅ 收到你的修改指令, 确认后按新的指令修改上次图片。'
      : '方案已就绪 ✨ 点下方"确认方案, 出图"开始生成。';

    const aiParts: AgentPart[] = [
      { type: 'plan', data: { prompt: enPromptBase, aspectRatio: finalAspectRatio, style: '', refImageUrls: refUrlsAccum, planFields: { subject: enPromptBase, negative: existingFields.negative || '' } } as any } as unknown as AgentPart,
      { type: 'text', text: baseText } as unknown as AgentPart,
    ];
    const aiMessage: AgentMessage = {
      id: generateUUID(),
      role: 'assistant',
      parts: aiParts,
      createdAt: Date.now(),
    };
    messages.push(aiMessage);

    // 5. 更新会话
    await imageConversationModel.update(conversationId, {
      messages,
      plan: { prompt: enPromptBase, aspectRatio: finalAspectRatio, refImageUrls: refUrlsAccum, style: '' } as any,
      planFields: newPlanFields,
      status: 'plan_ready' as AgentConversationStatus,  // v3.0.0.16: PR-M 极简模式直接 plan_ready (不再需要 translatePlan 翻译步骤)
    } as any);

    logger.info('ImageAgent: processTurn', {
      conversationId,
      isModification,
      userTextLen: enPromptBase.length,
      finalPromptLen: enPromptBase.length,
      promptOptimized,
      promptOptimizedMode,
      aspectRatio: finalAspectRatio,
    });

    return { conversationId, aiMessage, status: 'plan_ready' };
  }

  /** DEPRECATED: v3.0.0.16 极简模式后不再使用, 计划 v3.1.0 删除
   *  - 原 v3.0.0.13 流程: processTurn → plan_cn_ready → translatePlan → plan_ready
   *  - v3.0.0.16+: processTurn 直接 plan_ready, 前端 AgentChatPanel.confirmAndGenerate 也跳过 translatePlan
   *  - 但 routes/imageAgent.ts 仍挂载 POST /translate-plan, controller 仍调此方法
   *  - 现 processTurn 已不再返 plan_cn_ready, 状态检查会拒绝调用; 保留方法只为不破坏 API 契约
   *  - v3.1.0 cleanup: 删 routes/translate-plan + controller.translatePlan + 此方法
   */
  async translatePlan(conversationId: string): Promise<{ conversationId: string; status: AgentConversationStatus; enPrompt: string; cnDescription: string; negative: string; missingFields?: Array<{ key: string; label: string }> }> {
    const conv = await imageConversationModel.findById(conversationId);
    if (!conv) throw new Error(`会话不存在: ${conversationId}`);
    if (conv.status !== 'plan_cn_ready') {
      throw new Error(`当前状态 ${conv.status} 不可翻译, 需 plan_cn_ready`);
    }

    // v3.0.0.13: 拿 plan.prompt (processTurn 存的用户原文)
    const userText = (conv.plan as any)?.prompt || '';
    const userNegative = parsePlanFields(conv.plan_fields).negative || '';
    if (!userText.trim()) {
      // 没有原文, 返回 missingFields
      return {
        conversationId,
        status: 'plan_cn_ready' as AgentConversationStatus,
        enPrompt: '',
        cnDescription: '',
        negative: '',
        missingFields: [{ key: 'subject', label: '主体 (用户输入为空)' }],
      };
    }

    // 1. 状态: plan_cn_ready → plan_translating (短暂)
    await imageConversationModel.update(conversationId, {
      status: 'plan_translating' as AgentConversationStatus,
    } as any);

    // 2. v3.0.0.28 (S48): 100% 原文 passthrough, buildFinalEnglishPrompt 内部已简化为 return userText.trim()
    const { enPrompt, negative } = buildFinalEnglishPrompt(userText, userNegative);

    // 3. 状态: plan_translating → plan_ready
    const planObj = {
      prompt: enPrompt,
      aspectRatio: (conv.plan as any)?.aspectRatio || '1024x1024',
      style: '',
      refImageUrls: (conv.plan as any)?.refImageUrls || [],
      negative,
      cnDescription: userText,  // 调试用, 跟 enPrompt 一样的原文
    };

    await imageConversationModel.update(conversationId, {
      status: 'plan_ready' as AgentConversationStatus,
      plan: planObj,
      // 不更新 messages, 避免重复显示中文方案
    } as any);

    logger.info('ImageAgent: translatePlan done', {
      conversationId,
      enLen: enPrompt.length,
    });

    return { conversationId, status: 'plan_ready', enPrompt, cnDescription: userText, negative };
  }

  /** DEPRECATED: v3.0.0.16 极简模式后不再使用, 计划 v3.1.0 删除
   *  - 原 v3.0.0.2 流程: 用户在 plan_cn_ready 可手动改 10 字段, 然后重新 translatePlan
   *  - v3.0.0.16+: 极简 passthrough 删了 10 字段 UI (前端 AgentChatPanel 无 form 改动), 只能改 subject
   *  - routes/imageAgent.ts 仍挂载 PUT /plan-fields, controller 仍调此方法
   *  - 现 processTurn 已不再返 plan_cn_ready, 状态检查会拒绝调用; 保留方法只为不破坏 API 契约
   *  - v3.1.0 cleanup: 删 routes/plan-fields + controller.updatePlanFields + 此方法
   */
  async updatePlanFields(conversationId: string, updates: Partial<PlanFields>): Promise<{ conversationId: string; status: AgentConversationStatus; planFields: PlanFields }> {
    const conv = await imageConversationModel.findById(conversationId);
    if (!conv) throw new Error(`会话不存在: ${conversationId}`);
    if (conv.status !== 'plan_cn_ready' && conv.status !== 'plan_translating' && conv.status !== 'plan_ready') {
      throw new Error(`当前状态 ${conv.status} 不可改字段`);
    }

    const current = parsePlanFields(conv.plan_fields);
    const updated: Record<string, string> = { ...current };
    for (const [k, v] of Object.entries(updates)) {
      if (typeof v === 'string') updated[k] = v;
    }

    // 改字段后回退到 plan_cn_ready (让用户重新点"翻译")
    await imageConversationModel.update(conversationId, {
      status: 'plan_cn_ready' as AgentConversationStatus,
      planFields: updated,
    } as any);

    return { conversationId, status: 'plan_cn_ready', planFields: updated as unknown as PlanFields };
  }

  /** v3.0.0.17: 用户确认 → 返 taskId (status: queued) + 后台 fire-and-forget 跑 agens image
   *  - 跟 video 一样的持久化模式: 用户关浏览器, 后台任务继续跑, DB 写好, 用户回来 GET conversation 看到结果
   *  - 不再同步 await agens (之前会让前端 hang 5-30s, 期间用户看不到 streaming 卡片, 关页面就 500)
   *  - 8K/4K bug fix: 用 parseAspectToDims 替代硬编码 if-else
   */
  async confirm(conversationId: string): Promise<{ taskId: string; status: 'queued'; error?: string }> {
    // v3.0.0.32 (S54 P0 fix): 异步任务加锁 — 重复 confirm 触发多条 background 链
    // (并发 confirm 都会通过 conv.status === 'plan_ready' 检查 → 都启动 runImageGenerationBackground → 多条 agens 任务 + 多 quota 计数)
    // 必须在第一行 SYNCHRONOUSLY 抢锁 (Map.set 是同步), 否则并发 confirm 都在 await findById 时跳过锁检查
    // 取锁策略: 直接拒绝 (throw) — 让前端知道, 不要静默复用
    if (imageBackgroundLocks.has(conversationId)) {
      logger.warn('ImageAgent: confirm rejected, background lock held', { conversationId });
      throw new Error('上一个生图任务还在进行中, 请稍候再试');
    }
    // 占位 promise, 让 has() 立即命中
    imageBackgroundLocks.set(conversationId, new Promise<void>(() => {}));

    try {
      const conv = await imageConversationModel.findById(conversationId);
      if (!conv) throw new Error(`会话不存在: ${conversationId}`);
      if (conv.status !== 'plan_ready') throw new Error(`当前状态 ${conv.status} 不可确认, 需 plan_ready`);

      const plan = parsePlan(conv.plan);
      if (!plan || !plan.prompt) throw new Error('会话无 plan, 无法生成');

      // 1. v3.0.0.31 (S51): 生图免费 + 日限额检查
      const hasRef = !!(plan.refImageUrls && plan.refImageUrls.length > 0);
      const amount = estimateCharging(conv.mode, hasRef);  // 永远 0
      const user = await userModel.findById(conv.user_id);
      const isVip = isVipActive(user);
      const dailyCount = await billingService.imageDailyCount(conv.user_id);
      const quota = isVip ? IMAGE_DAILY_QUOTA_VIP : IMAGE_DAILY_QUOTA_STANDARD;
      if (dailyCount >= quota) {
        logger.warn('ImageAgent: daily quota exceeded', { userId: conv.user_id, dailyCount, quota, isVip });
        throw new Error(
          isVip
            ? `今日生图已达 ${dailyCount} 张 (VIP 限额异常, 请联系客服)`
            : `今日生图已达 ${dailyCount} 张上限, 升级 VIP 解锁无限生成`
        );
      }
      logger.info('ImageAgent: free (S51 quota check passed)', {
        userId: conv.user_id, dailyCount, quota, isVip, mode: conv.mode, hasRef,
      });

      // 2. 状态: plan_ready → tool_queued
      // v3.0.0.27 (S47): mutate messages - 在 plan 后 push streaming part, refresh 也能看到 generating
      const preConfirmMsgs = pushStreamingProgress(parseMessages(conv.messages), 'generating');
      await imageConversationModel.update(conversationId, {
        status: 'tool_queued' as AgentConversationStatus,
        messages: preConfirmMsgs as any,
      } as any);

      // 3. 写 image_generations 审计 (queued)
      const taskId = await imageGenerationModel.create({
        conversationId,
        prompt: plan.prompt,
        refImageUrls: plan.refImageUrls || [],
      });

      // 4. fire-and-forget 后台调 agens image
      //    不 await — 用户 confirm 立刻返 taskId, 任务在后台跑
      // v3.0.0.32 (S54 P0 fix): bg 完成时 (finally) 释放锁 — 避免重复 confirm 触发多条 background 链
      // 双重 delete 安全 (Map.delete 不存在的 key 是 no-op); 早失败路径 catch 也会 delete
      const bgPromise = this.runImageGenerationBackground(conversationId, taskId, plan, conv.last_result_url || null, amount)
        .catch((err) => {
          logger.error('ImageAgent: background run failed (unexpected)', {
            conversationId, taskId, error: (err as Error).message,
          });
        })
        .finally(() => {
          imageBackgroundLocks.delete(conversationId);
        });
      // 替换占位 promise 为真实 bgPromise (锁的"占用"维持到 bg 完成)
      imageBackgroundLocks.set(conversationId, bgPromise);

      logger.info('ImageAgent: confirm queued, background started', {
        conversationId, taskId, hasRef, amount,
      });

      return { taskId, status: 'queued' };
    } catch (err) {
      // v3.0.0.32 (S54 P0 fix): 早失败路径释放锁 (status check / plan parse / quota / pre-work 失败)
      imageBackgroundLocks.delete(conversationId);
      throw err;
    }
  }

  /** v3.0.0.17: 后台跑 agnes image 生成, 完成后写 DB
   *  - 跟 video 的 startPolling 类似, 但 image API 是同步返 URL, 不用轮询
   *  - 5min 超时 (跟 agnesImageProvider 内部一致)
   *  - 失败 → tool_failed + error_msg
   */
  private async runImageGenerationBackground(
    conversationId: string,
    taskId: string,
    plan: PlanData,
    lastResultUrl: string | null,
    amount: number,
  ): Promise<void> {
    try {
      // 1) 收集 ref: 优先 user ref, 没有则 last_result_url
      const userRefUrls: string[] = (plan.refImageUrls || []).slice(0, 1);
      const isModification = !!lastResultUrl;
      const refImages: string[] | undefined = userRefUrls.length > 0
        ? userRefUrls
        : (isModification && lastResultUrl ? [lastResultUrl] : undefined);

      // 2) i2i prompt 策略 (跟之前一致)
      let finalPrompt = plan.prompt || '';
      if (isModification && refImages && refImages.length > 0) {
        let userOriginalText = '';
        try {
          const conv = await imageConversationModel.findById(conversationId);
          if (conv) {
            const allMessages = parseMessages(conv.messages);
            for (let i = allMessages.length - 1; i >= 0; i--) {
              if (allMessages[i].role === 'user') {
                userOriginalText = partsToText(allMessages[i].parts);
                break;
              }
            }
          }
        } catch {}
        if (userOriginalText) {
          finalPrompt =
            `${userOriginalText}\n\n` +
            `[Instruction for AI]: Based on the input image, apply ONLY the changes described above. ` +
            `Preserve everything else from the input image (composition, character identity, facial expression, ` +
            `pose, background scene, lighting, camera angle, style, colors, all other elements). ` +
            `The output should look 95% identical to the input except for the specified changes.`;
        } else {
          finalPrompt =
            `Based on the input image, regenerate applying these updates: ${plan.prompt}\n\n` +
            `CRITICAL: Preserve the original composition, character identity, facial expression, pose, ` +
            `background scene, lighting, camera angle, and all other unchanged elements from the input image. ` +
            `Only modify what is explicitly specified in the updates above.`;
        }
      }

      // 3) v3.0.0.17 8K/4K bug fix: 用 parseAspectToDims 解析所有比例 (4K/8K/16:9/2K/1:1/1152x768/1280x720 全部支持)
      const dims = parseAspectToDims(plan.aspectRatio) || DEFAULT_IMG_DIM;
      const [w, h] = dims;

      logger.info('ImageAgent: background run start', {
        conversationId, taskId, isModification, w, h, aspect: plan.aspectRatio,
        promptLen: finalPrompt.length,
      });

      // 4) 状态: tool_queued → tool_executing
      await imageConversationModel.update(conversationId, {
        status: 'tool_executing' as AgentConversationStatus,
      } as any);

      // 5) 调 agens image (5min 超时, 内部有 3 次重试)
      // v3.0.0 硬编码 'comic' — v3.1.0 等前端确认 plan.style 取值范围后从 (plan as any).style 取
      // 临时 fallback: plan.style → 'comic' (避免前端没传时拿 undefined 进 agens)
      // v3.0.52 (BUG-123): 包装 rate limiter (40/min), 排队时自动 await, log 排队位置 + ETA
      const result = await rateLimitedGenerate({
        taskId,
        label: 'imageAgent',
        imageOptions: {
          prompt: finalPrompt,
          angle: (plan as any).style || 'comic',
          width: w,
          height: h,
          referenceImages: refImages?.slice(0, 1),
        },
      });

      // 6) 写结果
      // v3.0.0.27 (S47): mutate 已有 streaming part → image (role: 'result'), 不再 push 新 message
      const prevMessages = parseMessages(
        (await imageConversationModel.findById(conversationId))?.messages,
      );
      const messages = replaceStreamingPart(prevMessages, {
        type: 'image', url: result.url, role: 'result' as const,
      } as unknown as AgentPart);

      await imageConversationModel.update(conversationId, {
        status: 'tool_completed' as AgentConversationStatus,
        resultImageUrl: result.url,
        lastResultUrl: result.url,
        aspectRatio: plan.aspectRatio,
        chargedAmount: amount,
        messages,
      } as any);

      await imageGenerationModel.update(taskId, {
        status: 'completed',
        result_url: result.url,
        charged_amount: amount,
      } as any);

      // v3.0.32 BUG-078 S71: 主图生成完成, 走统一 recordConsumption 记录消费
      // 免费 (VIP unlimited) 也记录, isFree=true
      const imgAspectRatio = plan.aspectRatio || '1:1';
      // v3.0.32 BUG-078: 重新查 conv 拿 user_id (避免 block scope)
      const convForLog = await imageConversationModel.findById(conversationId);
      if (convForLog) {
        await billingService.recordConsumption(convForLog.user_id, {
          refType: 'image',
          refId: taskId,
          refLabel: `图片生成 ${imgAspectRatio}`,
          amount,
          isFree: amount === 0,
          description: `图片生成 ${imgAspectRatio}`,
          wordCount: 0,
        }).catch((e) => {
          logger.warn('ImageAgent: recordConsumption failed (non-blocking)', {
            conversationId, taskId, error: e?.message,
          });
        });
      }

      logger.info('ImageAgent: background run done', {
        conversationId, taskId, resultUrl: result.url.slice(0, 80),
      });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      logger.error('ImageAgent: background run failed', {
        conversationId, taskId, error: errMsg,
      });
      // 友好化错误
      let friendlyMsg = errMsg;
      if (errMsg.includes('timeout') || errMsg.includes('fetch failed')) {
        friendlyMsg = 'agnes 图像服务暂时不可用 (上游 OpenAI 繁忙), 请稍后重试';
      } else if (errMsg.includes('429')) {
        friendlyMsg = 'agnes 图像 API 限流中, 请稍后重试';
      }
      // v3.0.32 BUG-082: 强制归一为 string, 防历史: agnes API error 形如 {code, message} 被原样存进 messages JSON, web 渲染对象触发 React #31
      const safeFriendlyMsg = extractErrorMessage(friendlyMsg, '图片生成失败');
      // 写失败状态
      // v3.0.0.27 (S47): mutate streaming → error, refresh 也能看到失败信息
      try {
        const prevMessages = parseMessages(
          (await imageConversationModel.findById(conversationId))?.messages,
        );
        const failMessages = replaceStreamingPart(prevMessages, {
          type: 'error', message: safeFriendlyMsg,
        } as unknown as AgentPart);
        await imageConversationModel.update(conversationId, {
          status: 'tool_failed' as AgentConversationStatus,
          error_msg: safeFriendlyMsg,
          messages: failMessages as any,
        } as any);
        await imageGenerationModel.update(taskId, {
          status: 'failed',
          error_msg: safeFriendlyMsg,
        } as any);
      } catch {}
    }
  }
}

export const imageAgentService = new ImageAgentService();
