// apps/server/src/services/videoAgentService.ts
// v3.0.0.14: 视频 Agent 服务 — 极简 passthrough (与图片 PR-M 一致)
// 详细设计: docs/V3_AGENT_MATRIX.md §6
//
// v3.0.0.14 简化:
//   - 删 LLM 决策 (SYSTEM_PROMPT / LLMVideoDecision / parseLLMVideoDecision)
//   - 删多轮 clarify (用户发什么直接 plan_ready, 走 agnes video)
//   - 删 agnesTextProvider import
//   - 保留: 异步任务 + 5s 轮询 + 失败重试 + i2v (modification 走 last_result_url)

import { agnesVideoProvider } from './agnesVideoProvider';
import { agnesTextProvider } from './agnesTextProvider';
import { videoConversationModel, videoGenerationModel } from '../models/videoConversation';
import { billingService, isVipActive, chargingForVideo } from './billingService';
import { userModel } from '../models/user';
import { execute } from '../models/db';
import { websocketService } from './websocket';
import { logger } from '../utils/logger';
import { generateUUID } from '../shared/utils';
import { AgentMessage, AgentPart, AgentConversationStatus, PlanData } from '../shared/types';
import { parseAspectToDims } from '../prompts/imageAspectRatio';
import { buildVideoPromptOptimizerMessages, buildStoryboardOptimizerMessages, isStoryboardScript } from '../prompts/videoAgentSystem';

// ── v3.0.24 (S61): LLM prompt 优化层配置 ──
// 计费: ¥0.01/次 (跟 billing_logs DECIMAL(10,2) 最小单位一致; 实测 0.005 会被 MySQL round 到 0.01)
// 超时: 30s, 超时 fallback 原文 passthrough
// 失败兜底: LLM 报错 / 返空 / 返 < 5 chars → 用 userText 原 trim 走
const VIDEO_PROMPT_LLM_TIMEOUT_MS = 30_000;
const VIDEO_PROMPT_LLM_COST = 0.01;
const VIDEO_PROMPT_LLM_MIN_OUTPUT = 5;  // LLM 返 < 5 chars 视为无效

// ── 异步任务锁 (P0 fix: 重复 confirm 触发多条 background 链) ──
// Map<conversationId, Promise<void>> — 跟踪进行中的 background 任务
// acquire(): 新 confirm 看到已有锁 → 复用或拒绝
// release(): background 完成时 (finally) 清掉
// v3.0.0.32 (S54): file-scope, 跨实例共享同一进程所有 confirm 入口
const videoBackgroundLocks = new Map<string, Promise<void>>();

// ── 计费 ──
// v3.0.0.31 (S51): 平台定价 — 按 VIP 状态 + durationSec 矩阵计费
// 普通: 5s=0, 10s=0.1, 15s=0.1
// VIP:   5s=0, 10s=0,   15s=0.1
// 替代原 v3.0.0.18 0.05*sec 跟 v3.0.0.21 白名单 [5,10,15] 简化
// 计费查表迁到 billingService.chargingForVideo
const DEFAULT_DURATION_SEC = 5;
const ALLOWED_DURATIONS = [5, 10, 15] as const;
const POLLING_INTERVAL_MS = 5000;
const MAX_POLLING_INTERVAL_MS = 30000;
const MAX_CONSECUTIVE_FAILURES = 5;
const MAX_POLLING_ATTEMPTS = 120;

// ── v3.0.0.14: aspect ratio → 尺寸映射 (与图片 agent 保持一致) ──
const ASPECT_DIMENSIONS: Record<string, { w: number; h: number }> = {
  '1024x1024': { w: 1024, h: 1024 },
  '1152x768':  { w: 1152, h: 768 },  // 16:9
  '768x1152':  { w: 768,  h: 1152 }, // 9:16
  '1280x720':  { w: 1280, h: 720 },
  '720x1280':  { w: 720,  h: 1280 },
  '1920x1080': { w: 1920, h: 1080 },
  '1080x1920': { w: 1080, h: 1920 },
  '2048x2048': { w: 2048, h: 2048 },
  '1024x768':  { w: 1024, h: 768 },  // 4:3
  '768x1024':  { w: 768,  h: 1024 },
  '1536x1024': { w: 1536, h: 1024 },
  '1024x1536': { w: 1024, h: 1536 },
  '1280x1280': { w: 1280, h: 1280 }, // 2K
};

const DEFAULT_ASPECT = '1152x768';

function parseMessages(raw: any): AgentMessage[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(raw) ? raw : [];
}

function parsePlan(raw: any): PlanData | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

function partsToText(parts: AgentPart[]): string {
  return parts.map(p => {
    if (p.type === 'text') return p.text;
    if (p.type === 'image') {
      // v3.0.0.16: reference image 已被抽到 refImageUrls, 不再拼到 prompt
      if ((p as any).role === 'reference') return '';
      return `[图片: ${p.url}]`;
    }
    if (p.type === 'plan') return `[方案: ${p.data.prompt}]`;
    if (p.type === 'question') return `[问题: ${p.data.question}]`;
    return '';
  }).filter(Boolean).join('\n');
}

function numFramesForDuration(sec: number, fps: number): number {
  // 满足 8n+1
  return Math.max(9, Math.min(441, Math.floor(sec * fps) + 1));
}

// v3.0.0.27 (S47): 在最后一个带 plan part 的 assistant message 后追加 { type: 'streaming', stage } part
// 用途: confirm 时持久化 generating 状态, 让 user 刷新页面也能看到 spinner
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

// v3.0.0.27 (S47): 把最后 assistant message 的 streaming part 替换为 newPart (video / error / image 等)
//   优先级: 1) 替换现有 streaming, 2) 找不到 streaming 就 push 在 plan 之后, 3) 都没有 push 新 assistant
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

export class VideoAgentService {

  async createConversation(userId: string): Promise<{ conversationId: string; welcome: AgentMessage }> {
    const conversationId = await videoConversationModel.create({ userId, mode: 'text2vid' });
    const welcome: AgentMessage = {
      id: generateUUID(),
      role: 'assistant',
      parts: [{ type: 'text', text: '你好, 我是视频助手 🎬\n告诉我你想生成什么视频, 比如 "一只猫在海滩散步的慢镜头" 等。' }],
      createdAt: Date.now(),
    };
    const messages = [welcome];
    await videoConversationModel.update(conversationId, {
      messages,
      status: 'awaiting_clarification' as AgentConversationStatus,
    } as any);
    return { conversationId, welcome };
  }

  /**
   * v3.0.0.14 极简 passthrough — 不调 LLM
   *   - 拿用户原文 + 末尾 quality tags
   *   - 直接 plan_ready (视频没有"中文方案"概念, 第一轮直接出)
   *   - aspectRatio 独立参数
   */
  async processTurn(
    conversationId: string,
    userInputParts: AgentPart[],
    aspectRatioFromClient?: string,
    durationSecFromClient?: number,
  ): Promise<{ conversationId: string; aiMessage: AgentMessage; status: AgentConversationStatus }> {
    const conv = await videoConversationModel.findById(conversationId);
    if (!conv) throw new Error('会话不存在');
    if (conv.user_id === undefined) throw new Error('会话无 user_id');

    const messages = parseMessages(conv.messages);
    const userMessage: AgentMessage = { id: generateUUID(), role: 'user', parts: userInputParts, createdAt: Date.now() };
    messages.push(userMessage);

    // 1. 拿用户原文 (用户输入的 text part)
    const userText = partsToText(userInputParts);
    // 2. 拿参考图 URL
    const refImageUrls = (userInputParts || [])
      .filter(p => p.type === 'image' && (p as any).role === 'reference')
      .map(p => (p as any).url)
      .filter(Boolean);
    // 3. 拿 aspectRatio (client > conv.plan > default)
    // v3.0.0.32 (S54): 走 parsePlan 拿强类型, 不再 cast conv.plan as any
    const aspectRatio = aspectRatioFromClient
      || parsePlan(conv.plan)?.aspectRatio
      || DEFAULT_ASPECT;
    // v3.0.0.20: 视频降级 — 用户传 8K/4K/2K (老 web 端 / curl 绕过) 降级到 16:9 默认, 视频 2048² 文件 50MB+ 用户扛不住
    const VIDEO_HEAVY_RATIOS = new Set(['2K', '4K', '8K', '2048x2048', '1280x1280']);
    let finalAspect = VIDEO_HEAVY_RATIOS.has(aspectRatio) ? DEFAULT_ASPECT : aspectRatio;
    // v3.0.0.22: 文字比例解析 (9:16/16:9/2:3/3:2/4:3/3:4/1:1) → WxH. ASPECT_DIMENSIONS 表只存 WxH 格式, 文字 key 需先转
    if (!ASPECT_DIMENSIONS[finalAspect]) {
      const textDims = parseAspectToDims(finalAspect);
      if (textDims) finalAspect = `${textDims[0]}x${textDims[1]}`;
    }
    if (finalAspect !== aspectRatio) {
      // v3.0.0.18 (audit #14): 区分降级原因 — heavy 比例 (2K/4K/8K) 走 heavy-ratio-downgrade,
      // 文字比例 (9:16/16:9 等) 走 text-ratio-resolved (不是降级, 是格式归一化)
      const isHeavy = VIDEO_HEAVY_RATIOS.has(aspectRatio);
      logger.info('VideoAgent: aspectRatio adjusted', {
        requested: aspectRatio,
        used: finalAspect,
        reason: isHeavy ? 'heavy-ratio-downgrade' : 'text-ratio-resolved',
        conversationId,
      });
    }
    const dim = ASPECT_DIMENSIONS[finalAspect] || ASPECT_DIMENSIONS[DEFAULT_ASPECT];
    // 4. v3.0.0.15: modification 模式 (i2v) — 用户在 tool_completed 后提修改, 走 last_result_url
    const isModification = conv.status === 'tool_completed' && !!conv.last_result_url;
    let lastResultUrl = conv.last_result_url || null;
    // v3.0.0.18: 如果 last_result_url 是公网 URL (startPolling cache 还没完成时 chat), 同步 cache + 改本地 URL
    // 这样 confirm 时 agens 拿的是本地 URL → inlineIfLocal 读盘转 base64 → agens 拿到视频 (稳定 + 快)
    if (isModification && lastResultUrl && /^https?:\/\//.test(lastResultUrl)) {
      try {
        await this.cacheVideoToLocal(conversationId, lastResultUrl);
        const url = new URL(lastResultUrl);
        const filename = url.pathname.split('/').pop() || `video-${Date.now()}.mp4`;
        const localUrl = `/api/agent/video-local/${conv.user_id}/${filename}`;
        await videoConversationModel.update(conversationId, {
          last_result_url: localUrl,
        } as any);
        lastResultUrl = localUrl;
        logger.info('VideoAgent: processTurn synced cache + set local last_result_url', { conversationId, localUrl });
      } catch (err) {
        logger.warn('VideoAgent: processTurn sync cache failed (fallback to agens URL)', {
          conversationId, error: (err as Error).message,
        });
      }
    }
    // 5. v3.0.24 (S61): LLM prompt 优化层 (双模式)
    //   - 通用模式 (普通一句话): LLM 改写成英文 + quality tags
    //   - 分镜模式 (含 【镜头/景别/构图/运镜 等字段): 保留字段/时间分段/对白/术语直译
    //   - 失败/超时/返空 → fallback 到 userText.trim() (旧 100% passthrough)
    //   - 计费: ¥0.01/次 (复用 billingService.chargeImage, description='video prompt LLM 优化')
    //   - enableThinking=false: 翻译+结构化是简单任务, 关 thinking 省 token + 延迟
    let finalPrompt = (userText || '').trim();
    let promptOptimized = false;
    let promptOptimizedMode: 'generic' | 'storyboard' | null = null;
    let promptOptimizeUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;
    if (finalPrompt && finalPrompt.length >= 3 && !isModification) {
      // i2v 模式 (modification) 跳过 LLM: 修改指令短 + 用户期望"按指令改", 不要 LLM 加工
      // v3.0.24 S61 v2: 检测是否为分镜脚本 → 选对应 system prompt
      const isStoryboard = isStoryboardScript(finalPrompt);
      const messages = isStoryboard
        ? buildStoryboardOptimizerMessages(finalPrompt)
        : buildVideoPromptOptimizerMessages(finalPrompt);
      promptOptimizedMode = isStoryboard ? 'storyboard' : 'generic';

      const t0 = Date.now();
      try {
        const llmPromise = agnesTextProvider.chatCompletion({
          messages,
          temperature: isStoryboard ? 0.5 : 0.7,  // 分镜需要更稳定, 降低 temperature
          maxTokens: isStoryboard ? 1500 : 800,    // 分镜允许更长输出
          enableThinking: false,
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('video-prompt-llm-timeout')), VIDEO_PROMPT_LLM_TIMEOUT_MS)
        );
        const llmResult = await Promise.race([llmPromise, timeoutPromise]);
        const llmOutput = (llmResult?.content || '').trim();
        if (llmOutput.length >= VIDEO_PROMPT_LLM_MIN_OUTPUT) {
          finalPrompt = llmOutput;
          promptOptimized = true;
          promptOptimizeUsage = llmResult.usage;
          // 计费 (复用 chargeImage, 失败不阻塞视频生成)
          try {
            await billingService.chargeImage(
              conv.user_id,
              VIDEO_PROMPT_LLM_COST,
              isStoryboard ? 'video prompt LLM 优化(分镜)' : 'video prompt LLM 优化',
              conversationId,
            );
          } catch (chargeErr) {
            logger.warn('VideoAgent: prompt optimize charge failed (non-blocking)', {
              conversationId,
              error: (chargeErr as Error).message,
            });
          }
          logger.info('VideoAgent: prompt optimized by LLM', {
            conversationId,
            mode: promptOptimizedMode,
            originalLen: userText.length,
            optimizedLen: llmOutput.length,
            elapsedMs: Date.now() - t0,
            usage: llmResult.usage,
          });
        } else {
          logger.warn('VideoAgent: LLM output too short, fallback to original', {
            conversationId,
            mode: promptOptimizedMode,
            outputLen: llmOutput.length,
            elapsedMs: Date.now() - t0,
          });
        }
      } catch (llmErr) {
        logger.warn('VideoAgent: LLM prompt optimization failed, fallback to original passthrough', {
          conversationId,
          mode: promptOptimizedMode,
          error: (llmErr as Error).message,
          elapsedMs: Date.now() - t0,
        });
      }
    }
    let useRefForI2V: string | undefined = undefined;
    if (isModification && lastResultUrl) {
      useRefForI2V = lastResultUrl;
    }

    // 6. 构造 plan (v3.0.0.18 加 durationSec: 3/5/10s 用户可选)
    const finalDurationSec = (ALLOWED_DURATIONS as readonly number[]).includes(durationSecFromClient as number)
      ? (durationSecFromClient as number)
      : DEFAULT_DURATION_SEC;
    const plan = {
      prompt: finalPrompt.slice(0, 4000),
      durationSec: finalDurationSec,
      width: dim.w,
      height: dim.h,
      fps: 24,
      refImageUrls: isModification ? [] : refImageUrls,  // i2v 模式不混 user ref, 直接用 last_result_url
      i2vSourceUrl: useRefForI2V || null,  // v3.0.0.15: modification 模式写入 i2v source, confirm 时调 agens image= 用
      // v3.0.0.22: aspectRatio 同步成 finalAspect, 让 UI 看到降级后的实际值 (如 '16:9' 而非 '8K')
      aspectRatio: finalAspect,
    };

    // 7. 构造 AI 消息
    const baseText = isModification
      ? '✅ 收到你的修改指令, 确认后按新指令修改上次视频。'
      : '方案已就绪 ✨ 点下方"确认方案, 出视频"开始生成。';
    const aiMessage: AgentMessage = {
      id: generateUUID(),
      role: 'assistant',
      parts: [
        { type: 'plan', data: plan as any } as unknown as AgentPart,
        { type: 'text', text: baseText } as unknown as AgentPart,
      ],
      createdAt: Date.now(),
    };
    messages.push(aiMessage);

    // 8. 更新会话
    await videoConversationModel.update(conversationId, {
      messages,
      plan,
      status: 'plan_ready' as AgentConversationStatus,
    } as any);

    logger.info('VideoAgent: processTurn', {
      conversationId,
      userTextLen: userText.length,
      finalPromptLen: finalPrompt.length,
      promptOptimized,
      promptOptimizedMode,
      promptOptimizeUsage,
      aspectRatio,
      isModification,
    });

    return { conversationId, aiMessage, status: 'plan_ready' };
  }

  async confirm(conversationId: string): Promise<{ taskId: string; videoId: string; status: 'queued' | 'failed'; error?: string }> {
    // v3.0.0.32 (S54 P0 fix): 异步任务加锁 — 重复 confirm 触发多条 background 链
    // (并发 confirm 都会通过 conv.status === 'plan_ready' 检查 → 都进 setImmediate → 多条 agens 任务 + 多扣费)
    // 必须在第一行 SYNCHRONOUSLY 抢锁 (Map.set 是同步), 否则并发 confirm 都在 await findById 时跳过锁检查
    // 取锁策略: 直接拒绝 (throw) — 让前端知道, 不要静默复用, 避免 UI 显示同一个 taskId 但实际是新任务
    if (videoBackgroundLocks.has(conversationId)) {
      logger.warn('VideoAgent: confirm rejected, background lock held', { conversationId });
      throw new Error('上一个视频任务还在进行中, 请稍候再试');
    }
    // 占位 promise (永不 resolve), 让 Map.has() 在 setImmediate 跑前就能命中; 后面 setImmediate 内会用真实 bgPromise 替换它
    videoBackgroundLocks.set(conversationId, new Promise<void>(() => {}));

    try {
      const conv = await videoConversationModel.findById(conversationId);
      if (!conv) throw new Error('会话不存在');
      if (conv.status !== 'plan_ready') throw new Error(`状态 ${conv.status} 不可确认, 需 plan_ready`);

      const plan = parsePlan(conv.plan);
      if (!plan || !plan.prompt) throw new Error('会话无 plan');

      const durationSec = plan.durationSec || DEFAULT_DURATION_SEC;
      // v3.0.0.31 (S51): VIP + duration 矩阵计费 + 余额守门
      const user = await userModel.findById(conv.user_id);
      const isVip = isVipActive(user);
      const chargedAmount = chargingForVideo(isVip, durationSec);
      if (chargedAmount > 0) {
        const balance = user?.balance || 0;
        if (balance < chargedAmount) {
          throw new Error(`余额不足 (需 ¥${chargedAmount.toFixed(2)}，当前 ¥${balance.toFixed(2)})，请先充值`);
        }
      }
      logger.info('VideoAgent: S51 charge preview', { userId: conv.user_id, isVip, durationSec, chargedAmount });
      const width = plan.width || 1152;
      const height = plan.height || 768;
      const fps = plan.fps || 24;
      const refUrls = (plan.refImageUrls as string[]) || [];
      // v3.0.0.15: i2v 模式 — modification 时用 last_result_url 作 i2v source
      const i2vSourceUrl = (plan as any).i2vSourceUrl as string | undefined;
      const useI2V = !!i2vSourceUrl;

      // 状态变 queued 前先备份原 plan (失败回滚用)
      const originalPlan = conv.plan;

      // v3.0.0.25 (S44): 清掉上一次的 error_msg, 避免 UI 继续显示红色错误
      // (例: 上次 createTask 失败 → 状态滚回 plan_ready + error_msg, 用户重新点 confirm
      //  应该看到 plan_ready 没错误, 而不是残留的旧 error_msg)
      // v3.0.0.27 (S47): mutate messages - 在最后带 plan 的 assistant message 后追加 streaming part,
      //   让 user 刷新页面时立即看到 generating spinner (前端 useEffect 已 work, 只缺 server 持久化)
      const preConfirmMessages = pushStreamingProgress(parseMessages(conv.messages), 'generating');
      await videoConversationModel.update(conversationId, {
        status: 'tool_queued' as AgentConversationStatus,
        error_msg: null as any,
        retry_count: 0,
        messages: preConfirmMessages as any,
      } as any);

      // v3.0.0.26 (S45): confirm 改为异步 — 立即返 taskId (placeholder), 后台跑 createTask + 轮询
      // 原因: agens createTask 60s × 1 retry = 2.5 min, 超过 nginx proxy_read_timeout (现 300s, 之前 120s)
      // user 看到 504 但 server 还在跑. 改成异步后, user 立即拿到 taskId, 后台跑, 永不 timeout.
      let createResult: Awaited<ReturnType<typeof agnesVideoProvider.createTask>> | null = null;

      // 启动后台 createTask + 失败回滚 + 持久化 + startPolling (全部 fire-and-forget)
      // v3.0.0.32 (S54 P0 fix): setImmediate 内启动 bg, finally 释放锁 (避免重复 confirm 触发多条 background 链)
      //   - lock 在 confirm 入口已 acquire; release 在 bg 完成时 (包含 createTask + DB persist + startPolling 启动)
      //   - polling 后续由 setTimeout 递归, 不在锁内 — 但状态已变 tool_queued/tool_executing, 二次 confirm 会被 status check 拦下
      //   - 若 setImmediate 前 throw (status check / plan parse / billing / pre-work), 外层 catch 释放锁
      setImmediate(() => {
        const bgPromise = this.runCreateTaskInBackground(
          conversationId, plan,
          useI2V ? i2vSourceUrl : (refUrls.length === 1 ? refUrls[0] : undefined),
          useI2V ? undefined : (refUrls.length > 1 ? refUrls : undefined),
          useI2V, originalPlan, durationSec, width, height, fps, refUrls,
        )
          .catch(err => {
            logger.error('VideoAgent: runCreateTaskInBackground failed', { conversationId, error: (err as Error).message });
            // 显式返 void — logger.error 返 winston Logger, 会让 Promise<Logger> 不匹配 Map<Promise<void>>
          })
          .finally(() => {
            videoBackgroundLocks.delete(conversationId);
          });
        // 替换占位 promise 为真实 bgPromise (锁的"占用"维持到 bg 完成)
        videoBackgroundLocks.set(conversationId, bgPromise);
      });

      // 写 video_generations 审计 (audit row, 立即写入 — taskId 占位)
      const taskId = await videoGenerationModel.create({
        conversationId,
        prompt: plan.prompt,
        refImageUrls: refUrls,
        durationSec,
        resolution: `${width}x${height}`,
      });

      logger.info('VideoAgent: confirm accepted, createTask running in background', {
        conversationId, taskId, videoId: 'pending',
      });

      // 立即返 taskId (实际是 audit row id, frontend 用它跟踪 — 真正的 agnes taskId 后续通过轮询拿)
      return { taskId, videoId: 'pending', status: 'queued' };
    } catch (err) {
      // v3.0.0.32 (S54 P0 fix): 早失败路径释放锁 (status check / plan parse / billing / pre-work 失败)
      // 双重 delete 安全 (Map.delete 不存在的 key 是 no-op); bg 完成时 finally 也会 delete
      videoBackgroundLocks.delete(conversationId);
      throw err;
    }
  }

  /**
   * v3.0.0.26 (S45): 后台跑 createTask + 失败回滚 + 持久化 + startPolling
   * 从 confirm() 拆出来, fire-and-forget. 不阻塞 HTTP 响应.
   */
  private async runCreateTaskInBackground(
    conversationId: string,
    plan: any,
    image: string | undefined,
    images: string[] | undefined,
    useI2V: boolean,
    originalPlan: any,
    durationSec: number,
    width: number,
    height: number,
    fps: number,
    refUrls: string[]
  ) {
    let createResult;
    try {
      // 调 agnes video 创建任务
      // v3.0.0.15: i2v 模式 — 用 last_result_url 作 image, 不混 user ref
      createResult = await agnesVideoProvider.createTask({
        prompt: plan.prompt,
        image,
        images,
        width, height,
        numFrames: numFramesForDuration(durationSec, fps),
        frameRate: fps,
      });
    } catch (err) {
      // 调 agens 失败, 状态回滚到 plan_ready 让用户能重试
      const errMsg = (err as Error).message;
      // 友好化错误信息 (agns 上游 down / network / 5xx)
      let friendlyMsg = errMsg;
      if (errMsg.includes('timeout') || errMsg.includes('fetch failed') || errMsg.includes('Service busy') || errMsg.includes('503')) {
        friendlyMsg = 'agns 视频服务暂时不可用 (上游 OpenAI 繁忙或服务维护), 请 5-10 分钟后重试';
      } else if (errMsg.includes('429')) {
        friendlyMsg = 'agns 视频 API 限流中, 请稍后重试';
      }
      logger.error('VideoAgent: agnes createTask failed (background), rolling back to plan_ready', {
        conversationId, error: errMsg, friendly: friendlyMsg,
      });
      // v3.0.0.27 (S47): mutate messages - 替换 streaming part 为 error, 跟 plan+streaming 一起持久化
      const curConv = await videoConversationModel.findById(conversationId);
      const failMessages = curConv
        ? replaceStreamingPart(parseMessages(curConv.messages), { type: 'error', message: friendlyMsg } as unknown as AgentPart)
        : [];
      await videoConversationModel.update(conversationId, {
        status: 'plan_ready' as AgentConversationStatus,
        plan: originalPlan as any,
        error_msg: friendlyMsg,
        messages: failMessages as any,
      } as any);
      return;
    }

    // v3.0.0 修复: agnes videoId 是 base64 编码的 LiteLLM 路由路径 (~250 字符), 超出原 VARCHAR(100)。
    // 实际查询时 agnes 接受 video_id 或 task_id, 这里把 taskId (44 字符短) 存到 video_id 字段,
    // 长 videoId 存到 plan JSON 备用。
    const shortId = createResult.taskId || createResult.videoId;

    try {
      // 持久化 taskId / videoId
      await videoConversationModel.update(conversationId, {
        task_id: createResult.taskId,
        video_id: shortId,
        duration_sec: durationSec,
        resolution: `${width}x${height}`,
        fps,
        plan: { ...(plan as any), _agnesVideoId: createResult.videoId } as any,
      } as any);
    } catch (err) {
      logger.error('VideoAgent: persist taskId/videoId failed (background)', {
        conversationId, error: (err as Error).message,
      });
      await videoConversationModel.update(conversationId, {
        status: 'plan_ready' as AgentConversationStatus,
        plan: originalPlan as any,
        error_msg: (err as Error).message,
      } as any);
      return;
    }

    // 启动后台轮询 (立即开始) — 用长 videoId (plan._agnesVideoId) 调 agnes query
    this.startPolling(conversationId, createResult.videoId);

    logger.info('VideoAgent: createTask done (background), polling started', {
      conversationId, videoId: createResult.videoId.slice(0, 60),
    });
  }

  /** 后台轮询 — 起步 5s, 失败 backoff 到 30s 上限, 连续失败 5 次暂停 */
  private startPolling(conversationId: string, videoId: string) {
    let attempts = 0;
    let consecutiveFailures = 0;
    let currentInterval = POLLING_INTERVAL_MS;
    let timer: NodeJS.Timeout | null = null;

    const tick = async () => {
      attempts++;
      try {
        const status = await agnesVideoProvider.queryStatus(videoId);
        consecutiveFailures = 0;
        currentInterval = POLLING_INTERVAL_MS;  // 成功一次回到 5s

        const conv = await videoConversationModel.findById(conversationId);
        if (!conv) return;  // timer already cleared

        // v3.0.0.31 (S51): VIP + duration 矩阵计费 + 成功生成后真扣费
        const durationSecVal = conv.duration_sec || DEFAULT_DURATION_SEC;
        const user = await userModel.findById(conv.user_id);
        const isVip = isVipActive(user);
        const chargedAmount = chargingForVideo(isVip, durationSecVal);

        if (status.status === 'completed' && status.videoUrl) {
          // 真扣费 (跟 confirm 守门一致, 但成功后才写 billing_logs)
          if (chargedAmount > 0) {
            const chargeResult = await billingService.chargeVideo(conv.user_id, durationSecVal, isVip, conversationId);
            if (!chargeResult) {
              // v3.0.31 (S69 BUG-072 E): 视频已生成但扣费失败 (余额被其他任务花完)
              // → 标记 billing_status='unsettled' (前端显示 "余额不足, 充值后解锁视频")
              // → billing_logs 写 'consumption_pending' 占位 (审计)
              logger.error('VideoAgent: S69 chargeVideo failed (balance insufficient, video already generated)', {
                conversationId, userId: conv.user_id, durationSecVal, isVip, chargedAmount,
              });
              await videoConversationModel.update(conversationId, {
                billing_status: 'unsettled',
              } as any);
              await execute(
                `INSERT INTO billing_logs (id, user_id, type, amount, balance_after, novel_id, description, word_count, created_at)
                 VALUES (?, ?, 'consumption_pending', ?, ?, ?, ?, 0, ?)`,
                [generateUUID(), conv.user_id, chargedAmount, user?.balance || 0, conversationId, `视频生成(${durationSecVal}s${isVip ? '/VIP' : '/普通'}) - 待结算`, Date.now()],
              );
              websocketService.broadcastBalanceUpdate(conversationId, user?.balance || 0);
            } else {
              logger.info('VideoAgent: S51 charged', {
                conversationId, userId: conv.user_id, durationSecVal, isVip,
                chargedAmount: chargeResult.chargedAmount, balanceAfter: chargeResult.balanceAfter,
              });
              // v3.0.31 (S69 BUG-072 E): 显式写 settled (跟默认 'settled' 一致, 但保险起见)
              await videoConversationModel.update(conversationId, {
                billing_status: 'settled',
              } as any);
            }
          } else {
            logger.info('VideoAgent: S51 free (5s or VIP 10s)', { conversationId, durationSecVal, isVip });
            await videoConversationModel.update(conversationId, {
              billing_status: 'settled',
            } as any);
          }

          // v3.0.0.27 (S47): mutate 已有 streaming part → video, 不再 push 新 message
          const messages = replaceStreamingPart(parseMessages(conv.messages), {
            type: 'video', url: status.videoUrl, duration: durationSecVal,
          } as unknown as AgentPart);
          await videoConversationModel.update(conversationId, {
            status: 'tool_completed' as AgentConversationStatus,
            result_video_url: status.videoUrl,
            last_result_url: status.videoUrl,  // v3.0.0.15: 持续对话 i2v 用 (跟图片 PR-D 一致)
            charged_amount: chargedAmount,
            messages,
          } as any);
          // v3.0.0.31: video_generations audit row 也写 charged_amount
          // 找该 conversation 最新一条 video_generations row (polling 路径拿不到 taskId, 用 query)
          try {
            const { queryOne } = await import('../models/db');
            const genRow = await queryOne<any>(
              `SELECT id FROM video_generations WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1`,
              [conversationId]
            );
            if (genRow?.id) {
              await videoGenerationModel.update(genRow.id, {
                charged_amount: chargedAmount,
              } as any);
            }
          } catch (err) {
            logger.warn('VideoAgent: video_generations.charged_amount update failed', { error: (err as Error).message });
          }
          logger.info('VideoAgent: polling completed', { conversationId, videoId, videoUrl: status.videoUrl.slice(0, 60) });

          // v3.0.0.18: 同步等 cacheVideoToLocal 完成 (用户改视频时 shipin-APP 本地缓存就绪)
          // 完成后重写 last_result_url 为本地 URL, 这样 modification i2v 时 agens 拉 shipin-APP 本地 (稳定 + 快)
          try {
            await this.cacheVideoToLocal(conversationId, status.videoUrl);
            // 取本地 URL (用 status.videoUrl filename, 跟 cacheVideoToLocal 写盘路径一致)
            const url = new URL(status.videoUrl);
            const filename = url.pathname.split('/').pop() || `video-${Date.now()}.mp4`;
            const localUrl = `/api/agent/video-local/${conv.user_id}/${filename}`;
            await videoConversationModel.update(conversationId, {
              last_result_url: localUrl,
            } as any);
            logger.info('VideoAgent: cache done, last_result_url → local', { conversationId, localUrl });
          } catch (err) {
            logger.warn('VideoAgent: cacheVideoToLocal failed (non-fatal, keep agens URL)', {
              conversationId, error: (err as Error).message,
            });
          }
          return;  // stop
        } else if (status.status === 'failed') {
          const retryCount = (conv.retry_count || 0) + 1;
          const newStatus: AgentConversationStatus = retryCount < 3 ? 'plan_ready' : 'tool_failed';
          // v3.0.0.27 (S47): mutate streaming → error, refresh 也能看到失败信息
          const failMsg = status.error || '视频生成失败';
          const messages = replaceStreamingPart(parseMessages(conv.messages), {
            type: 'error', message: failMsg,
          } as unknown as AgentPart);
          await videoConversationModel.update(conversationId, {
            status: newStatus,
            retry_count: retryCount,
            error_msg: failMsg,
            messages,
          } as any);
          logger.warn('VideoAgent: polling failed', { conversationId, videoId, retryCount, error: status.error });
          return;  // stop
        } else {
          // in_progress / queued
          await videoConversationModel.update(conversationId, {
            status: 'tool_executing' as AgentConversationStatus,
          } as any);
          logger.debug('VideoAgent: polling progress', { conversationId, videoId, progress: status.progress, interval: currentInterval });
        }
      } catch (err: any) {
        consecutiveFailures++;
        // 429 限流 / 5xx 等: backoff 翻倍 (5→10→20→40→60, 上限 30s)
        currentInterval = Math.min(currentInterval * 2, MAX_POLLING_INTERVAL_MS);
        logger.warn('VideoAgent: polling error, backing off', {
          conversationId, videoId, consecutiveFailures, nextInterval: currentInterval, error: err?.message,
        });

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          // 连续 5 次失败, 暂停轮询, 标 tool_throttled 让用户能感知
          await videoConversationModel.update(conversationId, {
            status: 'tool_throttled' as AgentConversationStatus,
            error_msg: `API 限流 / 持续失败, 已暂停轮询 (${consecutiveFailures} 次). 请稍后手动重试`,
          } as any).catch(() => {});
          logger.error('VideoAgent: polling throttled, stopped', { conversationId, videoId, consecutiveFailures });
          return;  // stop
        }
        if (err?.message?.includes('429')) {
          // 429 显式: 不更新状态 (仍在 tool_executing), 只 backoff
        }
      }

      if (attempts >= MAX_POLLING_ATTEMPTS) {
        await videoConversationModel.update(conversationId, {
          status: 'tool_failed' as AgentConversationStatus,
          error_msg: '轮询超时 (>10分钟)',
        } as any).catch(() => {});
        logger.error('VideoAgent: polling timeout', { conversationId, videoId });
        return;  // stop
      }

      // 安排下一次 (用当前 interval, 失败 backoff / 成功 5s)
      timer = setTimeout(tick, currentInterval);
    };

    timer = setTimeout(tick, POLLING_INTERVAL_MS);
  }

  /** v3.0.0.1: 把 video 从 agens 拉到 shipin-APP 本地, 用户从本地磁盘读, 跳过外网
   *  - 文件名: 跟 googleapis URL 末段一致 (含 .mp4)
   *  - 存到: ${UPLOAD_DIR}/videos/{userId}/{filename}
   *  - 写 DB 字段: local_video_path 相对路径
   *  - 失败不阻塞, 业务侧 fallback 到 result_video_url (agens URL) */
  private async cacheVideoToLocal(conversationId: string, videoUrl: string): Promise<void> {
    try {
      const url = new URL(videoUrl);
      const filename = url.pathname.split('/').pop() || `video-${Date.now()}.mp4`;
      const conv = await videoConversationModel.findById(conversationId);
      if (!conv) return;
      const userId = conv.user_id;

      const fs = require('fs');
      const path = require('path');
      const uploadDir = process.env.UPLOAD_DIR || '/www/wwwroot/shipin-APP/uploads';
      const userDir = path.join(uploadDir, 'videos', userId);
      if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
      const filePath = path.join(userDir, filename);
      const relPath = `videos/${userId}/${filename}`;

      // 已经缓存过了, 跳过
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
        logger.info('VideoAgent: cacheVideoToLocal already exists, skip', { conversationId, filePath });
        return;
      }

      logger.info('VideoAgent: cacheVideoToLocal start', { conversationId, videoUrl, filePath });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);  // 5 min timeout

      const upstream = await fetch(videoUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!upstream.ok || !upstream.body) {
        logger.warn('VideoAgent: cacheVideoToLocal upstream not ok', { conversationId, status: upstream.status });
        return;
      }

      const reader = upstream.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      // v3.0.0.1: 视频一般 2-3 MB, 内存安全; 不用 stream-to-disk (避免占 IO)
      // eslint-disable-next-line no-constant-condition -- 显式循环, done 时 break
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          totalBytes += value.length;
        }
      }
      fs.writeFileSync(filePath, Buffer.concat(chunks));

      // 更新 DB 字段 (model update Partial<row> 接受任意 key)
      await videoConversationModel.update(conversationId, {
        localVideoPath: relPath,
      } as any);

      logger.info('VideoAgent: cacheVideoToLocal done', {
        conversationId, filePath, totalBytes, relPath,
      });
    } catch (err: any) {
      logger.error('VideoAgent: cacheVideoToLocal error', {
        conversationId, videoUrl, error: err?.message,
      });
      throw err;
    }
  }
}

export const videoAgentService = new VideoAgentService();
