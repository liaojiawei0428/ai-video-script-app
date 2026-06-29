// apps/server/src/services/agnesVideoProvider.ts
// v3.0.0: 视频生成 Provider (POST /v1/videos + GET /agnesapi?video_id=)
// 详细设计: docs/V3_AGENT_MATRIX.md §1.3 + §6
// v3.0.51 (BUG-122): 拆 3 个企业 key, video 优先读 AGNES_VIDEO_API_KEY (企业配额独立, 并发更高)
//   - 优先级: AGNES_VIDEO_API_KEY (企业 video 专用) > AGNES_API_KEY (统一) > AGNES_IMAGE_API_KEY (老兼容)

import { logger } from '../utils/logger';
import { extractFirstFrameAsPngBase64 } from '../utils/ffmpegHelper';
import { extractErrorMessage } from '../utils/errorUtils';

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

    // v3.0.0.25 (S44): retry 策略 + S72 batch 4 后置 BUG-085 修
    //  - 单次 timeout 60s: i2v 模式 (大图 base64 + 15s 视频) agens 端写 file 慢, 30s 不够
    //  - 2 次 retry: 6-25 视频实测 agnes 上游 OpenAI 视频生成服务繁忙, 60s timeout 经常撞, 1 retry 不够 (S44 时代偶尔 1 retry 够)
    //  - 5s backoff: 短 backoff 让 retry 更快, 总耗时仍可控
    //  - 总耗时: 60 + 5 + 60 + 5 + 60 = 190s = 3.17 min 后 throw (vs S44 老 60 + 30 + 60 = 150s = 2.5 min)
    //  - 修法: 加重 retry 给上游多次恢复机会, BUG-085 (4+ 次连续失败) 修
    const MAX_RETRIES = 3;  // 2 retries (attempt 0 + attempt 1 + attempt 2)
    const PER_TIMEOUT_MS = 60 * 1000;
    const RETRY_BACKOFF_MS = [5000, 5000];  // 5s, 5s — 短 backoff 让 retry 更快

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

        if (response.status === 429 || response.status === 503 || (response.status >= 500 && response.status < 600)) {
          // 限流/上游忙: 重试
          const errText = await response.text().catch(() => '');
          lastError = new Error(`Agnes Video create error (${response.status}): ${errText.slice(0, 200)}`);
          logger.warn('AgnesVideoProvider: createTask retryable error', {
            attempt, status: response.status, error: lastError.message.slice(0, 100),
          });
          if (attempt < MAX_RETRIES - 1) {
            await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS[attempt]));
            continue;
          }
          throw lastError;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Agnes Video create error (${response.status}): ${errorText.slice(0, 200)}`);
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
        // 网络错误 / 超时: 也重试
        if (err instanceof Error && err.name === 'AbortError') {
          lastError = new Error(`Agnes Video create timeout (${PER_TIMEOUT_MS}ms)`);
        } else if (err instanceof Error && /retryable/.test(err.message)) {
          // 上面已经处理, continue 走不到
        } else {
          lastError = err as Error;
        }
        if (attempt < MAX_RETRIES - 1) {
          logger.warn('AgnesVideoProvider: createTask network error, will retry', {
            attempt, error: (lastError as Error).message.slice(0, 100),
          });
          await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS[attempt]));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError || new Error('Agnes Video create failed after retries');
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
