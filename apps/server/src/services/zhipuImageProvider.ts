import { ImageProvider, ImageGenOptions, ImageGenResult } from './imageProvider';
import { logger } from '../utils/logger';

const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/images/generations';

const SIZE_OPTIONS: Record<string, string> = {
  front_bust: '1056x1568',
  side_bust: '1056x1568',
  full_body: '1056x1568',
  sheet: '1728x960',  // 三视图横向宽幅
};

export class ZhipuImageProvider implements ImageProvider {
  readonly name = 'zhipu-glm-image';
  readonly supportsNegativePrompt = false;

  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ZHIPU_IMAGE_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('ZHIPU_IMAGE_API_KEY not set, falling back to placeholder');
    }
  }

  async generate(options: ImageGenOptions): Promise<ImageGenResult> {
    if (!this.apiKey) {
      throw new Error('智谱 API Key 未配置 (ZHIPU_IMAGE_API_KEY)');
    }

    const start = Date.now();
    const size = SIZE_OPTIONS[options.angle] || '1280x1280';
    const body = {
      model: 'glm-image',
      prompt: options.prompt.slice(0, 1000),
      size,
    };

    logger.info('ZhipuImageProvider: generating', {
      angle: options.angle,
      promptLen: body.prompt.length,
      size,
    });

    let lastError: Error | null = null;
    let rateLimited = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(ZHIPU_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (response.status === 429) {
          rateLimited = true;
          lastError = new Error('智谱API速率限制(429)');
          const retryAfter = response.headers.get('Retry-After');
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : (5000 + attempt * 10000);
          logger.warn('ZhipuImageProvider: rate limited', {
            attempt: attempt + 1,
            waitMs,
            angle: options.angle,
          });
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          logger.error('Zhipu API error', { status: response.status, errorText });
          throw new Error(`智谱 API 错误 (${response.status}): ${errorText.slice(0, 200)}`);
        }

        const data = await response.json() as {
          created: number;
          data: Array<{ url: string }>;
        };

        if (!data.data?.[0]?.url) {
          logger.error('Zhipu API: no image URL in response', { data });
          throw new Error('智谱 API 未返回图片链接');
        }

        const durationMs = Date.now() - start;
        logger.info('ZhipuImageProvider: done', {
          durationMs,
          urlPrefix: data.data[0].url.slice(0, 80),
          angle: options.angle,
        });

        return {
          url: data.data[0].url,
          seed: options.seed || 0,
          durationMs,
        };
      } catch (err: any) {
        lastError = err;
        if (err.message?.includes('速率限制') || err.message?.includes('429')) {
          rateLimited = true;
          const waitMs = 5000 + attempt * 10000;
          logger.warn('ZhipuImageProvider: retrying after rate limit', { attempt: attempt + 1, waitMs });
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        throw err;
      }
    }

    logger.error('ZhipuImageProvider: all retries exhausted', {
      angle: options.angle,
      rateLimited,
      lastError: lastError?.message,
    });
    throw lastError || new Error('智谱图像生成失败（速率限制，已重试3次）');
  }
}
