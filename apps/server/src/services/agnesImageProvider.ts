import { ImageProvider, ImageGenOptions, ImageGenResult } from './imageProvider';
import { logger } from '../utils/logger';

const AGNES_API_URL = 'https://apihub.agnes-ai.com/v1/images/generations';
const AGNES_MODEL = 'agnes-image-2.0-flash';

const SIZE_OPTIONS: Record<string, string> = {
  front_bust: '768x1024',
  side_bust: '768x1024',
  full_body: '768x1024',
  sheet: '1536x1024',
  comic: '2048x2048',     // v2.5.19: 漫画分格页 (1:1 方形)
};

export class AgnesImageProvider implements ImageProvider {
  readonly name = 'agnes-image-2.0-flash';
  readonly supportsNegativePrompt = false;

  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.AGNES_IMAGE_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('AGNES_IMAGE_API_KEY not set');
    }
  }

  async generate(options: ImageGenOptions): Promise<ImageGenResult> {
    if (!this.apiKey) {
      throw new Error('Agnes API Key 未配置 (AGNES_IMAGE_API_KEY)');
    }

    const start = Date.now();
    // v2.5.23: 优先使用调用方传入的 width/height, 否则按 angle 查表
    const size = (options.width && options.height)
      ? `${options.width}x${options.height}`
      : (SIZE_OPTIONS[options.angle] || '1024x1024');

    const body = {
      model: AGNES_MODEL,
      prompt: options.prompt.slice(0, 4000),
      size,
    };

    logger.info('AgnesImageProvider: generating', {
      angle: options.angle,
      promptLen: body.prompt.length,
      size,
    });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
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

        if (response.status === 429) {
          lastError = new Error('Agnes API 速率限制(429)');
          const waitMs = 5000 + attempt * 10000;
          logger.warn('AgnesImageProvider: rate limited', { attempt: attempt + 1, waitMs });
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          logger.error('Agnes API error', { status: response.status, errorText });
          throw new Error(`Agnes API 错误 (${response.status}): ${errorText.slice(0, 200)}`);
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
        });

        return {
          url,
          seed: options.seed || 0,
          durationMs,
        };
      } catch (err: any) {
        lastError = err;
        if (err.message?.includes('429') || err.message?.includes('速率限制')) {
          const waitMs = 5000 + attempt * 10000;
          logger.warn('AgnesImageProvider: retrying', { attempt: attempt + 1, waitMs });
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        throw err;
      }
    }

    logger.error('AgnesImageProvider: all retries exhausted', {
      angle: options.angle,
      lastError: lastError?.message,
    });
    throw lastError || new Error('Agnes 图像生成失败（已重试3次）');
  }
}
