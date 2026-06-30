// apps/server/src/services/agnesVideoProvider.ts
// v3.0.0: 视频生成 Provider (POST /v1/videos + GET /agnesapi?video_id=)
// 详细设计: docs/V3_AGENT_MATRIX.md §1.3 + §6
// v3.0.51 (BUG-122): 拆 3 个企业 key, video 优先读 AGNES_VIDEO_API_KEY (企业配额独立, 并发更高)
//   - 优先级: AGNES_VIDEO_API_KEY (企业 video 专用) > AGNES_API_KEY (统一) > AGNES_IMAGE_API_KEY (老兼容)
// v3.0.63 (S72 batch 32 BUG-132): retry 策略细化, content_policy 跟其他 4xx 不 retry, 避免连续撞 agens 限流 429
//   - 修前: catch 块 (line 277) 盲目 retry 所有 throw, 包括 400 content_policy_violation, 3 次 retry 在 1 分钟内打 3 次 → 第 3 次撞 agens 2/min 限流 → 用户看到 "agns 视频 API 限流中" 但根因是 content_policy 拒绝
//   - 修后: 区分 retryable (429/503/5xx/AbortError) vs non-retryable (content_policy_violation/其他 4xx/网络解析错), throw 类型化 error, 上层 videoAgentService 解码友好文案
//   - backoff 加长 5s→8s/12s 减少撞限流机率

import { logger } from '../utils/logger';
import { extractFirstFrameAsPngBase64 } from '../utils/ffmpegHelper';
import { extractErrorMessage } from '../utils/errorUtils';

/**
 * v3.0.63 (BUG-132): 错误类型枚举, 用于上层 videoAgentService 决定 retry 策略 + 友好文案
 */
export enum AgnesVideoErrorType {
  CONTENT_POLICY = 'content_policy',     // 400 content_policy_violation — 不能 retry
  RATE_LIMIT = 'rate_limit',             // 429 — retryable 但需更长 backoff
  UPSTREAM_BUSY = 'upstream_busy',       // 503/5xx — retryable
  TIMEOUT = 'timeout',                   // AbortError — retryable
  INVALID_INPUT = 'invalid_input',       // 其他 4xx — 不能 retry
  NETWORK = 'network',                   // fetch failed/JSON 解析 — 谨慎 retry
  UNKNOWN = 'unknown',
}

export class AgnesVideoError extends Error {
  constructor(
    public readonly type: AgnesVideoErrorType,
    public readonly agensStatus: number,
    message: string,
    public readonly agensRaw?: string,
  ) {
    super(message);
    this.name = 'AgnesVideoError';
  }
}

/**
 * v3.0.63 (BUG-132): 根据 agens 错误信息判断类型
 */
function classifyAgnesError(status: number, rawText: string): AgnesVideoErrorType {
  if (status === 400 || status === 401 || status === 403) {
    if (rawText.includes('content_policy_violation')) return AgnesVideoErrorType.CONTENT_POLICY;
    if (rawText.includes('rate_limit')) return AgnesVideoErrorType.RATE_LIMIT;  // 一些版本 400 返限流
    return AgnesVideoErrorType.INVALID_INPUT;
  }
  if (status === 429) return AgnesVideoErrorType.RATE_LIMIT;
  if (status === 503 || (status >= 500 && status < 600)) return AgnesVideoErrorType.UPSTREAM_BUSY;
  return AgnesVideoErrorType.UNKNOWN;
}

const AGNES_VIDEO_CREATE_URL = 'https://apihub.agnes-ai.com/v1/videos';
const AGNES_VIDEO_QUERY_URL = 'https://apihub.agnes-ai.com/agnesapi';
const AGNES_MODEL = 'agnes-video-v2.0';

export interface AgnesVideoCreateOptions {
  prompt: string;
  image?: string;                       // 单图 (string)
  images?: string[];                    // 多图 (array, 用 extra_body.image)
  width?: number;
  height?: number;
  numFrames?: number;                   // ≤ 441, 满足 8n+1
  frameRate?: number;                   // 1-60
  mode?: 'keyframes';                   // 关键帧模式 (多图)
  negativePrompt?: string;
  seed?: number;
}

export interface AgnesVideoCreateResult {
  taskId: string;
  videoId: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  seconds?: number;
  size?: string;
}

export interface AgnesVideoStatusResult {
  taskId: string;
  videoId: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  /** 视频 URL 字段, 注意: agnes 在 completed 时把 URL 放在 remixed_from_video_id 字段 (反人类) */
  videoUrl?: string;
  /**
   * 错误消息, 已归一为 string
   * v3.0.32 BUG-082: agnes API 返 {error: {code, message}} 对象, provider 层就过 extractErrorMessage 归一,
   *   避免调用方 (videoAgentService) 忘记归一直接存进 messages JSON, web 渲染对象触发 React #31
   */
  error?: string;
}

export class AgnesVideoProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.AGNES_VIDEO_API_KEY || process.env.AGNES_API_KEY || process.env.AGNES_IMAGE_API_KEY || '';
    if (!this.apiKey) logger.warn('AGNES_VIDEO_API_KEY (或 AGNES_API_KEY / AGNES_IMAGE_API_KEY) not set for video');
  }

  /** v3.0.0.18: 把 shipin-APP 同源 URL 规范化成相对路径 + 读盘转纯 base64
   *  - web 端可能发 https://ab.maque.uno/api/agent/uploads/... (拼了 origin)
   *  - agens 拿同源 URL 会 401 (没 JWT), 必须转 base64 inline
   *  - agnes video 期待纯 base64 字符串 (不带 data: 前缀) */
  private async inlineIfLocal(url: string): Promise<string> {
    if (!url) return url;
    if (url.startsWith('data:')) return url;

    // v3.0.0.18: 规范化 shipin-APP 同源 URL → 相对路径
    let normalized = url;
    const httpMatch = url.match(/^https?:\/\/([^\/]+)/);
    if (httpMatch) {
      try {
        const u = new URL(url);
        if (u.pathname.startsWith('/api/agent/uploads/') || u.pathname.startsWith('/api/agent/video-local/')) {
          normalized = u.pathname;
          logger.info('AgnesVideoProvider: normalized shipin-APP URL to relative', { original: url, normalized });
        } else {
          return url;  // 真正的公网 URL, 不处理
        }
      } catch {}
    }

    const fs = require('fs');
    const path = require('path');
    const uploadBase = process.env.UPLOAD_DIR || '/www/wwwroot/shipin-APP/uploads';

    // 1) 图片: /api/agent/uploads/{userId}/{filename}
    const imgMatch = normalized.match(/\/api\/agent\/uploads\/([^/]+)\/([^/]+)$/);
    if (imgMatch) {
      const filePath = path.join(uploadBase, 'agent-references', imgMatch[1], imgMatch[2]);
      if (!fs.existsSync(filePath)) {
        logger.warn('AgnesVideoProvider: ref file not found on disk', { filePath });
        return url;
      }
      const buf = fs.readFileSync(filePath);
      // v3.0.0.18: agnes video 期待纯 base64 字符串 (不带 data: 前缀)
      const base64 = buf.toString('base64');
      logger.info('AgnesVideoProvider: inlined ref image to base64', { filename: imgMatch[2], bytes: buf.length, b64Len: base64.length });
      return base64;
    }

    // 2) 视频: /api/agent/video-local/{userId}/{filename} (i2v modification)
    //    v3.0.0.22: agens 上游 image 字段只接受 PNG/JPG 图片, 传 mp4 base64 会 500 (cannot identify image)
    //    解决: 用 ffmpeg 抽首帧 → PNG → base64, agnes 当 i2v image 处理
    //    v3.0.0.23 (S43): 抽帧逻辑挪到 utils/ffmpegHelper.extractFirstFrameAsPngBase64, 这里只调
    const vidMatch = normalized.match(/\/api\/agent\/video-local\/([^/]+)\/([^/]+)$/);
    if (vidMatch) {
      const filePath = path.join(uploadBase, 'videos', vidMatch[1], vidMatch[2]);
      if (!fs.existsSync(filePath)) {
        logger.warn('AgnesVideoProvider: video local not found on disk', { filePath });
        return url;
      }
      try {
        const result = extractFirstFrameAsPngBase64(filePath);
        logger.info('AgnesVideoProvider: extracted first frame for i2v', {
          filename: vidMatch[2],
          mp4Bytes: result.mp4Bytes,
          pngBytes: result.pngBytes,
          dimensions: result.dimensions,
          b64Len: result.base64.length,
        });
        return result.base64;
      } catch (err: any) {
        logger.error('AgnesVideoProvider: ffmpeg frame extraction failed', { filePath, error: err.message });
        return url;  // 失败 fallback 到原 URL (agns 上游会 500, 但至少不崩)
      }
    }

    // 3) 都不匹配: 返回原 URL
    return url;
  }

  /** 创建视频任务 — 自动重试 timeout / 503 / 429 / 5xx 错误 (S72 batch 4 加重 retry, 5s backoff × 2)
   *  v3.0.52 (BUG-123): 包装 rate limiter (Agnes video 2/min), 调用方传 taskId 用于排队追踪
   *  用法: agnesVideoProvider.createTaskWithLimit(opts, 'task-id-123', 'videoAgent')
   */
  async createTaskWithLimit(
    opts: AgnesVideoCreateOptions,
    taskId: string,
    label: string = 'video',
  ): Promise<AgnesVideoCreateResult> {
    const { getAgnesVideoLimiter } = await import('../utils/rateLimiter');
    const limiter = getAgnesVideoLimiter();
    const startWaitLog = Date.now();

    const statusBefore = limiter.getStatus();
    if (statusBefore.active >= statusBefore.limit) {
      const queueInfo = limiter.getTaskQueueInfo(taskId);
      logger.info(`[RateLimit] ${label} taskId=${taskId} 排队中: 第 ${queueInfo.position} 位, 预计 ${queueInfo.etaSeconds}s`);
    }

    const slot = await limiter.acquire(taskId);
    const waitedMs = Date.now() - startWaitLog;
    if (waitedMs > 100) {
      logger.info(`[RateLimit] ${label} taskId=${taskId} 已获 slot, 排队等待 ${waitedMs}ms`);
    }

    try {
      return await this.createTask(opts);
    } finally {
      slot.release();
    }
  }

  async createTask(opts: AgnesVideoCreateOptions): Promise<AgnesVideoCreateResult> {
    if (!this.apiKey) throw new Error('Agnes API Key 未配置');

    const body: any = {
      model: AGNES_MODEL,
      prompt: opts.prompt.slice(0, 4000),
      num_frames: opts.numFrames || 121,        // 5s @ 24fps
      frame_rate: opts.frameRate || 24,
    };
    if (opts.width) body.width = opts.width;
    if (opts.height) body.height = opts.height;
    if (opts.negativePrompt) body.negative_prompt = opts.negativePrompt;
    if (opts.seed !== undefined) body.seed = opts.seed;

    if (opts.image) {
      // 单图: 顶层 image 字段 (string)
      // v3.0.0.1: 如果是 /api/agent/uploads/ URL, agnes 拉不到 (它没 JWT), 改成内联 base64
      const inlined = await this.inlineIfLocal(opts.image);
      logger.info('AgnesVideoProvider: createTask image (inlined)', { 
        inputUrl: opts.image.slice(0, 100), 
        outputPreview: inlined.slice(0, 60), 
        outputLen: inlined.length,
      });
      body.image = inlined;
    } else if (opts.images && opts.images.length > 0) {
      // 多图: extra_body.image 数组
      const inlined = await Promise.all(opts.images.map(u => this.inlineIfLocal(u)));
      body.extra_body = { image: inlined, mode: opts.mode || 'keyframes' };
    }

    logger.info('AgnesVideoProvider: createTask', {
      numFrames: body.num_frames,
      frameRate: body.frame_rate,
      hasImage: !!opts.image,
      imageCount: opts.images?.length || 0,
      promptLen: body.prompt.length,
    });

    // v3.0.0.25 (S44) + S72 batch 4 (BUG-085) + S72 batch 32 (BUG-132) + 🆕 v3.0.65 (S72 batch 33 BUG-133 timeout 调整)
    //  - v3.0.65 BUG-133 修法: agens 端 5s 视频实测 3-4 min 后端排队 (OpenAI 视频模型慢) + shipin-app image 端 60s 不影响
    //    修前 PER_TIMEOUT_MS=60s + MAX_RETRIES=3 + backoff 8s/12s = 200s 总时长, agens 队列慢必撞 throw timeout
    //    修后 PER_TIMEOUT_MS=180s (3 min 单 attempt) + MAX_RETRIES=2 + backoff 30s/15s = 8.25 min 总时长, 给 agens 充分排队恢复机会
    //  - 跨端铁律 4 验证 (刚才 web E2E): shipin-app 端实测 5s 普通 prompt 视频生成本来能成功, 修前 throw 后用户看不到 success 看到 "超时"; 修后给 8 min 让 agens 排队 + 用户看到 status='tool_executing' 进度
    //  - 跟 BUG-123 (客户端 sliding window 限流器 2/min) 1:1 配套: 客户端 6.5 min polling 跟服务端 8 min retry 匹配, 用户看到 status='tool_queued' "⏳ 排队中..." 真反馈
    //  - BUG-132 关键修法保留: 区分 retryable (429/503/5xx/timeout) vs non-retryable (content_policy 永远 retry 解不了)
    const MAX_RETRIES = 2;  // 🆕 v3.0.65: 3 → 2 (跟 timeout 加长平衡)
    const PER_TIMEOUT_MS = 180 * 1000;  // 🆕 v3.0.65: 60s → 180s (3 min) 等 agens 队列恢复
    const RETRY_BACKOFF_MS = [30000, 15000];  // 🆕 v3.0.65: 8s/12s → 30s/15s (放宽 backoff 让上游充分恢复)

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PER_TIMEOUT_MS);
      try {
        const response = await fetch(AGNES_VIDEO_CREATE_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          // 成功路径 — 落下面 if (!response.ok) 之外
        } else {
          const errText = await response.text().catch(() => '');
          const errorType = classifyAgnesError(response.status, errText);
          // v3.0.63 BUG-132 关键修法: content_policy_violation / invalid_input / 其他不可重试错误, 立刻抛出不复 retry
          // 修前 line 229 仅 retry 429/503/5xx, 但 line 277 catch 块对 line 245 throw 的 4xx 错误**也盲目 retry**, 用户撞 content_policy → 3 次 retry → 撞 agens 2/min 限流 → 文案误导
          if (errorType === AgnesVideoErrorType.CONTENT_POLICY || errorType === AgnesVideoErrorType.INVALID_INPUT) {
            logger.warn('AgnesVideoProvider: createTask non-retryable error', {
              attempt, status: response.status, type: errorType, error: errText.slice(0, 100),
            });
            throw new AgnesVideoError(errorType, response.status, `Agnes Video create error (${response.status}): ${errText.slice(0, 200)}`, errText);
          }
          // 429 / 503 / 5xx → retryable
          lastError = new AgnesVideoError(errorType, response.status, `Agnes Video create error (${response.status}): ${errText.slice(0, 200)}`, errText);
          logger.warn('AgnesVideoProvider: createTask retryable error', {
            attempt, status: response.status, type: errorType, error: lastError.message.slice(0, 100),
          });
          if (attempt < MAX_RETRIES - 1) {
            await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS[attempt]));
            continue;
          }
          throw lastError;
        }

        const data = await response.json() as {
          id?: string;
          task_id?: string;
          video_id?: string;
          status?: string;
          progress?: number;
          seconds?: string | number;
          size?: string;
        };

        const taskId = data.task_id || data.id || '';
        const videoId = data.video_id || data.id || '';
        if (!videoId) throw new Error('Agnes video response missing video_id');

        logger.info('AgnesVideoProvider: createTask done', {
          taskId, videoId, attempt,
          status: data.status, progress: data.progress,
        });

        return {
          taskId,
          videoId,
          status: (data.status as any) || 'queued',
          progress: data.progress || 0,
          seconds: typeof data.seconds === 'string' ? parseFloat(data.seconds) : data.seconds,
          size: data.size,
        };
      } catch (err) {
        clearTimeout(timeoutId);
        // v3.0.63 BUG-132 关键修法: 区分 retryable vs non-retryable, 不再盲目 retry
        // 修前 line 277 盲目 retry 所有 throw (包括 400 content_policy_violation), 3 次 retry 在 1 min 内撞 agens 2/min 限流
        // 修后: AgnesVideoError (CONTENT_POLICY/INVALID_INPUT) 直接抛出不再 retry, RATE_LIMIT/UPSTREAM_BUSY 已经走 line 297 throw, AbortError (timeout) 也 retry
        if (err instanceof AgnesVideoError) {
          // 类型化错误, 直接抛出不再 retry (CONTENT_POLICY/INVALID_INPUT) — retry 永远解不了策略拦截
          // RATE_LIMIT/UPSTREAM_BUSY 已经在 line 297 throw lastError, 那也走不到这里 (如果走也是 throw)
          throw err;
        }
        // AbortError (timeout) 或其他网络错误: retry
        if (err instanceof Error && err.name === 'AbortError') {
          lastError = new AgnesVideoError(AgnesVideoErrorType.TIMEOUT, 0, `Agnes Video create timeout (${PER_TIMEOUT_MS}ms)`);
        } else {
          lastError = new AgnesVideoError(AgnesVideoErrorType.NETWORK, 0, (err as Error).message);
        }
        if (attempt < MAX_RETRIES - 1) {
          logger.warn('AgnesVideoProvider: createTask network/timeout error, will retry', {
            attempt, type: (lastError as AgnesVideoError | null)?.type, error: (lastError as Error).message.slice(0, 100),
          });
          await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS[attempt]));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError || new AgnesVideoError(AgnesVideoErrorType.UNKNOWN, 0, 'Agnes Video create failed after retries');
  }

  /** 查询任务状态 */
  async queryStatus(videoId: string): Promise<AgnesVideoStatusResult> {
    if (!this.apiKey) throw new Error('Agnes API Key 未配置');
    if (!videoId) throw new Error('videoId is required');

    const controller = new AbortController();
    const timeoutMs = 30 * 1000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // 推荐: GET /agnesapi?video_id=xxx
      const url = `${AGNES_VIDEO_QUERY_URL}?video_id=${encodeURIComponent(videoId)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Agnes Video query error (${response.status}): ${errorText.slice(0, 200)}`);
      }

      const data = await response.json() as {
        id?: string;
        video_id?: string;
        status?: string;
        progress?: number;
        seconds?: string | number;
        size?: string;
        // ⚠️ agnes 反人类: 视频 URL 放在 remixed_from_video_id 字段
        remixed_from_video_id?: string;
        error?: string;
      };

      const status = (data.status as any) || 'queued';
      const result: AgnesVideoStatusResult = {
        taskId: data.id || '',
        videoId: data.video_id || videoId,
        status,
        progress: data.progress || 0,
        // v3.0.32 BUG-082: provider 层就归一为 string, 防 agnes 返 {code, message} 对象
        //   (历史: server 原样存进 messages JSON, web 渲染对象触发 React #31)
        //   调用方 videoAgentService 就不用再记 extractErrorMessage
        error: extractErrorMessage(data.error, ''),
      };
      if (status === 'completed' && data.remixed_from_video_id) {
        result.videoUrl = data.remixed_from_video_id;
      }

      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}

export const agnesVideoProvider = new AgnesVideoProvider();
