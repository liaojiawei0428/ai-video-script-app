"use strict";
// apps/server/src/services/agnesImageProvider.ts
// v2.5.0: 接入 agnes-image-2.0-flash
// v2.5.23: 优先使用 width/height, fallback SIZE_OPTIONS
// v2.5.28: 升级到 agnes-image-2.1-flash 多模态, 支持 referenceImages
// v3.0.0: 修复字段路径 - 文档要求 image/response_format 必须在 extra_body 内 (顶层会 400)
// v3.0.0: 统一环境变量名 AGNES_API_KEY (兼容旧名 AGNES_IMAGE_API_KEY, 一个 key 通用 3 个模型)
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgnesImageProvider = void 0;
const logger_1 = require("../utils/logger");
const AGNES_API_URL = 'https://apihub.agnes-ai.com/v1/images/generations';
// v2.5.28: 升级到 Image 2.1 Flash (支持 multimodal: text + image_url)
// vs 文本模型 agnes-2.0-flash (chat/completions, 用于理解/对话)
const AGNES_MODEL = 'agnes-image-2.1-flash';
const SIZE_OPTIONS = {
    front_bust: '768x1024',
    side_bust: '768x1024',
    full_body: '768x1024',
    sheet: '1536x1024',
    comic: '2048x2048', // v2.5.19: 漫画分格页 (1:1 方形)
};
class AgnesImageProvider {
    name = 'agnes-image-2.1-flash';
    supportsNegativePrompt = false;
    apiKey;
    constructor(apiKey) {
        // v3.0.0: 优先用统一名 AGNES_API_KEY, 兼容旧名 AGNES_IMAGE_API_KEY (v2.5.x 历史)
        this.apiKey = apiKey || process.env.AGNES_API_KEY || process.env.AGNES_IMAGE_API_KEY || '';
        if (!this.apiKey) {
            logger_1.logger.warn('AGNES_API_KEY (或 AGNES_IMAGE_API_KEY) not set');
        }
    }
    /** v3.0.0.1: 把 /api/agent/uploads/ 本地 URL 读取并转 base64 data URL, agnes 拉不到鉴权 URL 必须内联 */
    async inlineIfLocal(url) {
        if (!url)
            return url;
        // v3.0.0.18: 把 shipin-APP 同源 URL 规范化成相对路径, agens 拉会 401 (没 JWT)
        let normalized = url;
        if (/^https?:\/\/[^\/]+/.test(url)) {
            try {
                const u = new URL(url);
                if (u.pathname.startsWith('/api/agent/uploads/')) {
                    normalized = u.pathname;
                    logger_1.logger.info('AgnesImageProvider: normalized shipin-APP URL to relative', { original: url, normalized });
                }
                else {
                    return url; // 真正的公网 URL, 不处理
                }
            }
            catch { }
        }
        if (normalized.startsWith('data:'))
            return url;
        const match = normalized.match(/\/api\/agent\/uploads\/([^/]+)\/([^/]+)$/);
        if (!match)
            return url;
        try {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(process.env.UPLOAD_DIR || '/www/wwwroot/shipin-APP/uploads', 'agent-references', match[1], match[2]);
            if (!fs.existsSync(filePath)) {
                logger_1.logger.warn('AgnesImageProvider: ref file not found on disk', { filePath });
                return url;
            }
            const buf = fs.readFileSync(filePath);
            const ext = match[2].toLowerCase();
            const mime = ext.endsWith('.png') ? 'image/png' : ext.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
            const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
            logger_1.logger.info('AgnesImageProvider: inlined ref image to base64', { filename: match[2], bytes: buf.length });
            return dataUrl;
        }
        catch (e) {
            logger_1.logger.warn('AgnesImageProvider: inlineIfLocal failed, fallback to URL', { error: e.message });
            return url;
        }
    }
    async generate(options) {
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
        const body = {
            model: AGNES_MODEL,
            prompt: options.prompt.slice(0, 4000),
            size,
            extra_body: {
                response_format: 'url', // ← v3.0.0: 必须在 extra_body
            },
        };
        if (options.referenceImages && options.referenceImages.length > 0) {
            // v3.0.0: 字段名 + 路径都改 - image_url (顶层 string) → extra_body.image (字符串或数组)
            // agnes-image-2.1-flash 单次只接受 1 张图, 取主角参考图
            let refImg = options.referenceImages[0];
            // v3.0.0.1: /api/agent/uploads/ URL 带鉴权, agnes 拉不到 (它没 JWT) → 读盘转 base64 data URL
            refImg = await this.inlineIfLocal(refImg);
            body.extra_body.image = refImg;
            // v2.5.29: 弱化参考图权重, 让 prompt 主导
            // 旧版 "Strictly follow" 强指令导致 agnes 把图当成主体, 输出"角色图"而非剧情
            // 改用 "soft anchor": 只用于身份匹配, 不影响场景构图
            // 参考 IPAdapter 经验: 降低 weight, 让 text prompt 主导 (70/30)
            body.prompt = `[A character reference image is attached for visual identity matching only. The image provides face shape, hairstyle, hair color, and outfit color of the LEAD CHARACTER. It is NOT a template for composition. Follow the PANEL DESCRIPTIONS in the prompt below as the primary content source. The reference image's pose, background, and composition should be IGNORED.]\n\n${body.prompt}`;
        }
        logger_1.logger.info('AgnesImageProvider: generating', {
            angle: options.angle,
            promptLen: body.prompt.length,
            size,
            hasReference: !!body.extra_body?.image,
            referenceCount: options.referenceImages?.length || 0,
        });
        let lastError = null;
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
                    logger_1.logger.warn('AgnesImageProvider: rate limited', { attempt: attempt + 1, waitMs });
                    await new Promise(r => setTimeout(r, waitMs));
                    continue;
                }
                if (!response.ok) {
                    const errorText = await response.text();
                    logger_1.logger.error('Agnes API error', { status: response.status, errorText });
                    throw new Error(`Agnes API 错误 (${response.status}): ${errorText.slice(0, 200)}`);
                }
                const data = await response.json();
                const imageUrl = data.data?.[0]?.url;
                const imageB64 = data.data?.[0]?.b64_json;
                if (!imageUrl && !imageB64) {
                    logger_1.logger.error('Agnes API: no image in response', { data });
                    throw new Error('Agnes API 未返回图片');
                }
                const url = imageUrl || `data:image/png;base64,${imageB64}`;
                const durationMs = Date.now() - start;
                logger_1.logger.info('AgnesImageProvider: done', {
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
            }
            catch (err) {
                lastError = err;
                if (err.message?.includes('429') || err.message?.includes('速率限制')) {
                    const waitMs = 5000 + attempt * 10000;
                    logger_1.logger.warn('AgnesImageProvider: retrying', { attempt: attempt + 1, waitMs });
                    await new Promise(r => setTimeout(r, waitMs));
                    continue;
                }
                throw err;
            }
        }
        logger_1.logger.error('AgnesImageProvider: all retries exhausted', {
            angle: options.angle,
            lastError: lastError?.message,
        });
        throw lastError || new Error('Agnes 图像生成失败（已重试3次）');
    }
}
exports.AgnesImageProvider = AgnesImageProvider;
