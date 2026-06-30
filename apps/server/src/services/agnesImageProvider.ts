// apps/server/src/services/agnesImageProvider.ts
// v2.5.0: 接入 agnes-image-2.0-flash
// v2.5.23: 优先使用 width/height, fallback SIZE_OPTIONS
// v2.5.28: 升级到 agnes-image-2.1-flash 多模态, 支持 referenceImages
// v3.0.0: 修复字段路径 - 文档要求 image/response_format 必须在 extra_body 内 (顶层会 400)
// v3.0.0: 统一环境变量名 AGNES_API_KEY (兼容旧名 AGNES_IMAGE_API_KEY, 一个 key 通用 3 个模型)
// v3.0.51 (BUG-122): 拆 3 个企业 key, image 继续用 AGNES_IMAGE_API_KEY (字段名复用 = 专用名 + 老兼容名合并, 不破坏老配置)
//   - 实际优先级: AGNES_IMAGE_API_KEY (企业 image 专用 + 老兼容合并字段, 读的就是它) > AGNES_API_KEY (统一)
// v3.0.63 (BUG-132 配套): retry 策略细化, content_policy 不 retry, 跟 video 同源 (修前 image 也有同样误导文案 + 盲目 retry 问题)

import { ImageProvider, ImageGenOptions, ImageGenResult } from './imageProvider';
import { logger } from '../utils/logger';

/**
 * v3.0.63 (BUG-132 配套): image error 类型 (跟 video 1:1 镜像, 跨端铁律 4++)
 */
export enum AgnesImageErrorType {
  CONTENT_POLICY = 'content_policy',
  RATE_LIMIT = 'rate_limit',
  UPSTREAM_BUSY = 'upstream_busy',
  TIMEOUT = 'timeout',
  INVALID_INPUT = 'invalid_input',
  NETWORK = 'network',
  UNKNOWN = 'unknown',
}

export class AgnesImageError extends Error {
  constructor(
    public readonly type: AgnesImageErrorType,
    public readonly agensStatus: number,
    message: string,
    public readonly agensRaw?: string,
  ) {
    super(message);
    this.name = 'AgnesImageError';
  }
}

/**
 * v3.0.63 (BUG-132 配套): 根据 agens 错误判断类型
 */
function classifyAgnesImageError(status: number, rawText: string): AgnesImageErrorType {
  if (status === 400 || status === 401 || status === 403) {
    if (rawText.includes('content_policy') || rawText.includes('content_safety')) return AgnesImageErrorType.CONTENT_POLICY;
    if (rawText.includes('rate_limit')) return AgnesImageErrorType.RATE_LIMIT;
    return AgnesImageErrorType.INVALID_INPUT;
  }
  if (status === 429) return AgnesImageErrorType.RATE_LIMIT;
  if (status === 503 || (status >= 500 && status < 600)) return AgnesImageErrorType.UPSTREAM_BUSY;
  return AgnesImageErrorType.UNKNOWN;
}

const AGNES_API_URL = 'https://apihub.agnes-ai.com/v1/images/generations';
// v2.5.28: 升级到 Image 2.1 Flash (支持 multimodal: text + image_url)
// vs 文本模型 agnes-2.0-flash (chat/completions, 用于理解/对话)
const AGNES_MODEL = 'agnes-image-2.1-flash';

const SIZE_OPTIONS: Record<string, string> = {
  front_bust: '768x1024',
  side_bust: '768x1024',
  full_body: '768x1024',
  sheet: '1536x1024',
  comic: '2048x2048',     // v2.5.19: 漫画分格页 (1:1 方形)
};

export class AgnesImageProvider implements ImageProvider {
  readonly name = 'agnes-image-2.1-flash';
  readonly supportsNegativePrompt = false;

  private apiKey: string;

  constructor(apiKey?: string) {
    // v3.0.0: 优先用统一名 AGNES_API_KEY, 兼容旧名 AGNES_IMAGE_API_KEY (v2.5.x 历史)
    this.apiKey = apiKey || process.env.AGNES_API_KEY || process.env.AGNES_IMAGE_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('AGNES_API_KEY (或 AGNES_IMAGE_API_KEY) not set');
    }
  }

  /** v3.0.0.1: 把 /api/agent/uploads/ 本地 URL 读取并转 base64 data URL, agnes 拉不到鉴权 URL 必须内联 */
  private async inlineIfLocal(url: string): Promise<string> {
    if (!url) return url;
    // v3.0.0.18: 把 shipin-APP 同源 URL 规范化成相对路径, agens 拉会 401 (没 JWT)
    let normalized = url;
    if (/^https?:\/\/[^\/]+/.test(url)) {
      try {
        const u = new URL(url);
        if (u.pathname.startsWith('/api/agent/uploads/')) {
          normalized = u.pathname;
          logger.info('AgnesImageProvider: normalized shipin-APP URL to relative', { original: url, normalized });
        } else {
          return url;  // 真正的公网 URL, 不处理
        }
      } catch {}
    }
    if (normalized.startsWith('data:')) return url;
    const match = normalized.match(/\/api\/agent\/uploads\/([^/]+)\/([^/]+)$/);
    if (!match) return url;
    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(process.env.UPLOAD_DIR || '/www/wwwroot/shipin-APP/uploads', 'agent-references', match[1], match[2]);
      if (!fs.existsSync(filePath)) {
        logger.warn('AgnesImageProvider: ref file not found on disk', { filePath });
        return url;
      }
      const buf = fs.readFileSync(filePath);
      const ext = match[2].toLowerCase();
      const mime = ext.endsWith('.png') ? 'image/png' : ext.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
      logger.info('AgnesImageProvider: inlined ref image to base64', { filename: match[2], bytes: buf.length });
      return dataUrl;
    } catch (e: any) {
      logger.warn('AgnesImageProvider: inlineIfLocal failed, fallback to URL', { error: e.message });
      return url;
    }
  }

  async generate(options: ImageGenOptions): Promise<ImageGenResult> {
    if (!this.apiKey) {
      throw new Error('Agnes API Key 未配置 (AGNES_API_KEY 或 AGNES_IMAGE_API_KEY)');
    }

    const start = Date.now();
    // v2.5.23: 优先使用调用方传入的 width/height, 否则按 angle 查表
    const size = (options.width && options.height)
      ? `${options.width}x${options.height}`
      : (SIZE_OPTIONS[options.angle] || '1024x1024');

    // v3.0.0: 按 Agnes 官方文档要求, image/response_format 必须在 extra_body 内 (顶层会 400)
    // 文档原话: "顶层 response_format 会 400, response_format 必须在 extra_body"
    const body: any = {
      model: AGNES_MODEL,
      prompt: options.prompt.slice(0, 4000),
      size,
      extra_body: {
        response_format: 'url',                  // ← v3.0.0: 必须在 extra_body
      },
    };

    if (options.referenceImages && options.referenceImages.length > 0) {
      // v3.0.0: 字段名 + 路径都改 - image_url (顶层 string) → extra_body.image (字符串或数组)
      // agnes-image-2.1-flash 单次只接受 1 张图, 取主角参考图
      let refImg = options.referenceImages[0];

      // v3.0.0.1: /api/agent/uploads/ URL 带鉴权, agnes 拉不到 (它没 JWT) → 读盘转 base64 data URL
      refImg = await this.inlineIfLocal(refImg);

      // BUG-121 (v3.0.50): 文档要求 extra_body.image 必须是 string[] 数组 (8.3/8.4/8.5 三个例子)
      // 修前: body.extra_body.image = refImg (传 string, agens API 容错接受)
      // 修后: body.extra_body.image = [refImg] (传 array, 严格按文档)
      // shipin-APP 单次只取 1 张主角参考图, 但 API 仍要求 array 形式
      // (跟 BUG-118/119/120 教训同源: API 容错不能当文档不一致挡箭牌, 必对齐)
      body.extra_body.image = [refImg];
      // v2.5.29: 弱化参考图权重, 让 prompt 主导
      // 旧版 "Strictly follow" 强指令导致 agnes 把图当成主体, 输出"角色图"而非剧情
      // 改用 "soft anchor": 只用于身份匹配, 不影响场景构图
      // 参考 IPAdapter 经验: 降低 weight, 让 text prompt 主导 (70/30)
      body.prompt = `[A character reference image is attached for visual identity matching only. The image provides face shape, hairstyle, hair color, and outfit color of the LEAD CHARACTER. It is NOT a template for composition. Follow the PANEL DESCRIPTIONS in the prompt below as the primary content source. The reference image's pose, background, and composition should be IGNORED.]\n\n${body.prompt}`;
    }

    logger.info('AgnesImageProvider: generating', {
      angle: options.angle,
      promptLen: body.prompt.length,
      size,
      hasReference: !!body.extra_body?.image,
      referenceCount: options.referenceImages?.length || 0,
    });

    let lastError: AgnesImageError | null = null;

    // v3.0.63 BUG-132 配套: image 限流比 video 高 (40/min vs 2/min), retry 次数从 3→2, 减少撞限流概率
    // 修前 5+10+15=30s backoff + 3 retries 在 user 操作密集时撞限流, 修后 8+12=20s + 2 retries 平衡
    const MAX_RETRIES = 2;
    const RETRY_BACKOFF_MS = [8000, 12000];

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // v2.5.19: 5 分钟超时 (漫画 2048x2048 生成较慢)
        const controller = new AbortController();
        const timeoutMs = 5 * 60 * 1000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(AGNES_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const errText = await response.text().catch(() => '');
        const errorType = classifyAgnesImageError(response.status, errText);

        // v3.0.63 BUG-132: content_policy_violation / invalid_input 不 retry, 立刻抛出
        if (errorType === AgnesImageErrorType.CONTENT_POLICY || errorType === AgnesImageErrorType.INVALID_INPUT) {
          logger.error('AgnesImageProvider: non-retryable error', {
            attempt, status: response.status, type: errorType, errorText: errText.slice(0, 100),
          });
          throw new AgnesImageError(errorType, response.status, `Agnes Image API 错误 (${response.status}): ${errText.slice(0, 200)}`, errText);
        }

        if (response.status === 429 || errorType === AgnesImageErrorType.UPSTREAM_BUSY || errorType === AgnesImageErrorType.RATE_LIMIT) {
          // 限流/上游忙: 重试
          lastError = new AgnesImageError(errorType, response.status, `Agnes Image API 错误 (${response.status}): ${errText.slice(0, 200)}`, errText);
          logger.warn('AgnesImageProvider: rate limited / upstream busy', { attempt: attempt + 1, type: errorType, status: response.status });
          if (attempt < MAX_RETRIES - 1) {
            await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS[attempt]));
            continue;
          }
          throw lastError;
        }

        if (!response.ok) {
          logger.error('Agnes API error', { status: response.status, errorText: errText });
          throw new AgnesImageError(errorType, response.status, `Agnes Image API 错误 (${response.status}): ${errText.slice(0, 200)}`, errText);
        }

        const data = await response.json() as {
          data: Array<{ url?: string; b64_json?: string }>;
        };

        const imageUrl = data.data?.[0]?.url;
        const imageB64 = data.data?.[0]?.b64_json;

        if (!imageUrl && !imageB64) {
          logger.error('Agnes API: no image in response', { data });
          throw new Error('Agnes API 未返回图片');
        }

        const url = imageUrl || `data:image/png;base64,${imageB64}`;
        const durationMs = Date.now() - start;

        logger.info('AgnesImageProvider: done', {
          durationMs,
          urlPrefix: url.slice(0, 80),
          angle: options.angle,
          hasReference: !!body.extra_body?.image,
        });

        return {
          url,
          seed: options.seed || 0,
          durationMs,
        };
      } catch (err: any) {
        // v3.0.63 BUG-132 配套: 区分非重试错误 vs 重试错误, 不再盲目 retry
        if (err instanceof AgnesImageError) {
          // 类型化错误, 直接抛出不再 retry (CONTENT_POLICY/INVALID_INPUT)
          // RATE_LIMIT/UPSTREAM_BUSY 已经在 line throw (上面), 这里只会是 CONTENT/INVALID
          throw err;
        }
        // AbortError (timeout) 或网络错
        if (err?.name === 'AbortError') {
          lastError = new AgnesImageError(AgnesImageErrorType.TIMEOUT, 0, `Agnes Image API 生成超时 (${5 * 60}ms)`);
        } else {
          lastError = new AgnesImageError(AgnesImageErrorType.NETWORK, 0, err?.message || String(err));
        }
        if (attempt < MAX_RETRIES - 1) {
          logger.warn('AgnesImageProvider: timeout/network, will retry', { attempt: attempt + 1, type: lastError.type });
          await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS[attempt]));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError || new AgnesImageError(AgnesImageErrorType.UNKNOWN, 0, 'Agnes Image API failed after retries');
  }
}
