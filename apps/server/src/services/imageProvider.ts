// 角色/镜头生图 Provider 适配层
// v2.0: 占位 SVG 实现 (确保流程跑通, 视觉效果基础)
// v2.5: 接入真实 provider (Midjourney/Stable Diffusion/国内厂商)

import { ImageVariant } from '../shared/types';
import { StylePresetId } from '../shared/types';
import { getStylePromptSuffix } from '../shared/stylePresets';
import * as crypto from 'crypto';

export interface ImageGenOptions {
  prompt: string;
  negativePrompt?: string;
  styleId?: StylePresetId;
  angle: 'front_bust' | 'side_bust' | 'full_body' | 'sheet' | 'comic';
  width?: number;
  height?: number;
  seed?: number;
  // v2.5.28: 多模态参考图 (agres-image-2.1-flash 支持)
  // 用于: 漫画生成时传入三视图作为角色一致性参考; 镜头生图时传入角色 sheet 图
  // agnes 接受字符串 image_url (单张) 或字符串数组 (多张)
  referenceImages?: string[];
}

export interface ImageGenResult {
  url: string;        // data:image/svg+xml;base64,... 或 http URL
  seed: number;
  durationMs: number;
}

export interface ImageProvider {
  readonly name: string;
  readonly supportsNegativePrompt: boolean;
  generate(options: ImageGenOptions): Promise<ImageGenResult>;
}

// ════════════════════════════════════════════════════════════
//  占位实现: SVG 生成器
//  根据 prompt + style + angle 生成有辨识度的占位图
//  v2.5 替换为真实 provider
// ════════════════════════════════════════════════════════════

const STYLE_COLORS: Record<StylePresetId, { bg: string; fg: string; accent: string }> = {
  realistic: { bg: '#1a1a1a', fg: '#e8c39e', accent: '#d4a574' },
  ancient:   { bg: '#f5f0e1', fg: '#3a3a3a', accent: '#8b4513' },
  cyber:     { bg: '#0a0a2e', fg: '#00ffff', accent: '#ff00ff' },
  anime:     { bg: '#ffe4e1', fg: '#ff69b4', accent: '#87ceeb' },
  '3d':      { bg: '#e0f7fa', fg: '#4a4a4a', accent: '#ffd54f' },
};

const ANGLE_LABELS: Record<ImageVariant['angle'], string> = {
  front_bust: '正面半身',
  side_bust: '侧面半身',
  full_body: '全身',
  sheet: '三视图',
  comic: '漫画分格',
};

/** 根据 prompt + style + angle 生成 SVG 占位图 */
function generatePlaceholderSvg(options: ImageGenOptions): string {
  const colors = STYLE_COLORS[options.styleId || 'realistic'];
  const seed = options.seed || hashStringToInt(options.prompt + options.angle);
  const rng = mulberry32(seed);

  const width = options.width || 512;
  const height = options.height || 512;
  const initials = extractInitials(options.prompt);
  const angleLabel = ANGLE_LABELS[options.angle];

  // 简单人形 SVG（占位）
  const headRadius = 60 + Math.floor(rng() * 10);
  const bodyWidth = 100 + Math.floor(rng() * 40);
  const isFullBody = options.angle === 'full_body';
  const figureHeight = isFullBody ? 280 : 180;
  const cx = width / 2;
  const cy = isFullBody ? height * 0.65 : height * 0.55;

  // 随机装饰元素（不同 prompt 不同）
  const decoCount = 2 + Math.floor(rng() * 3);
  const decorations: string[] = [];
  for (let i = 0; i < decoCount; i++) {
    const x = 30 + Math.floor(rng() * (width - 60));
    const y = 30 + Math.floor(rng() * 60);
    const r = 3 + Math.floor(rng() * 6);
    decorations.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${colors.accent}" opacity="0.4"/>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.bg};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${shadeColor(colors.bg, 20)};stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  ${decorations.join('\n  ')}
  <!-- 人形占位 -->
  <ellipse cx="${cx}" cy="${cy - figureHeight/2 + headRadius/2}" rx="${headRadius}" ry="${headRadius*1.1}" fill="${colors.fg}" opacity="0.85"/>
  <rect x="${cx - bodyWidth/2}" y="${cy - figureHeight/2 + headRadius*1.5}" width="${bodyWidth}" height="${figureHeight - headRadius*1.5}" rx="20" fill="${colors.fg}" opacity="0.7"/>
  ${isFullBody ? `<rect x="${cx - bodyWidth*0.4}" y="${cy + figureHeight/2 - 80}" width="${bodyWidth*0.3}" height="80" rx="10" fill="${colors.fg}" opacity="0.6"/><rect x="${cx + bodyWidth*0.1}" y="${cy + figureHeight/2 - 80}" width="${bodyWidth*0.3}" height="80" rx="10" fill="${colors.fg}" opacity="0.6"/>` : ''}
  <!-- 角标 -->
  <rect x="10" y="10" width="120" height="28" rx="4" fill="${colors.accent}" opacity="0.9"/>
  <text x="70" y="29" font-family="sans-serif" font-size="14" font-weight="bold" fill="${colors.bg}" text-anchor="middle">${angleLabel}</text>
  <!-- 角色名首字母 -->
  <text x="${width - 20}" y="${height - 20}" font-family="sans-serif" font-size="20" font-weight="bold" fill="${colors.fg}" text-anchor="end" opacity="0.6">${initials}</text>
  <!-- 风格水印 -->
  <text x="${width/2}" y="${height - 8}" font-family="sans-serif" font-size="9" fill="${colors.fg}" text-anchor="middle" opacity="0.4">Deep剧本 · 占位图 v2.0</text>
</svg>`;
}

function extractInitials(text: string): string {
  const cleaned = text.replace(/[^\u4e00-\u9fa5A-Za-z\s]/g, '').trim();
  if (!cleaned) return '?';
  // 中文字符取首字
  if (/[\u4e00-\u9fa5]/.test(cleaned)) {
    return cleaned.match(/[\u4e00-\u9fa5]/)?.[0] || '?';
  }
  // 英文取首字母
  return cleaned.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3);
}

function hashStringToInt(s: string): number {
  const hash = crypto.createHash('sha256').update(s).digest();
  return hash.readUInt32BE(0);
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0xff) + percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** 占位 Provider: 生成 SVG data URL */
export class PlaceholderImageProvider implements ImageProvider {
  readonly name = 'placeholder-svg';
  readonly supportsNegativePrompt = false;

  async generate(options: ImageGenOptions): Promise<ImageGenResult> {
    const start = Date.now();
    // 模拟 AI 生成延迟 (200-600ms)
    await new Promise(r => setTimeout(r, 200 + Math.random() * 400));

    const svg = generatePlaceholderSvg(options);
    const base64 = Buffer.from(svg).toString('base64');
    const url = `data:image/svg+xml;base64,${base64}`;
    const seed = options.seed || hashStringToInt(options.prompt + options.angle);

    return {
      url,
      seed,
      durationMs: Date.now() - start,
    };
  }
}

// ════════════════════════════════════════════════════════════
//  Provider 注册表 + 工厂方法
// ════════════════════════════════════════════════════════════

let defaultProvider: ImageProvider = new PlaceholderImageProvider();

function autoInitProvider(): ImageProvider {
  // v3.0.51 (BUG-122): 拆 3 个企业 key, image 优先读 AGNES_IMAGE_API_KEY (字段名复用 = 专用 + 老兼容合并)
  //   - 优先级: AGNES_IMAGE_API_KEY (企业 image 专用 + 老兼容合并) > AGNES_API_KEY (统一) > ZHIPU_IMAGE_API_KEY (备选)
  const agnesKey = process.env.AGNES_IMAGE_API_KEY || process.env.AGNES_API_KEY;
  if (agnesKey) {
    const { AgnesImageProvider } = require('./agnesImageProvider');
    const provider = new AgnesImageProvider(agnesKey);
    defaultProvider = provider;
    console.log(`[ImageProvider] 已注册: ${provider.name} (key source: ${process.env.AGNES_IMAGE_API_KEY ? 'AGNES_IMAGE_API_KEY (企业 image 专用 / 老兼容合并)' : 'AGNES_API_KEY (统一, 兼容老)'})`);
    return provider;
  }
  const zhipuKey = process.env.ZHIPU_IMAGE_API_KEY;
  if (zhipuKey) {
    const { ZhipuImageProvider } = require('./zhipuImageProvider');
    const provider = new ZhipuImageProvider(zhipuKey);
    defaultProvider = provider;
    console.log(`[ImageProvider] 已注册: ${provider.name}`);
    return provider;
  }
  console.log(`[ImageProvider] 使用占位 SVG (未配置 AGNES_IMAGE_API_KEY / AGNES_API_KEY / ZHIPU_IMAGE_API_KEY)`);
  return defaultProvider;
}

export const imageProvider: ImageProvider = autoInitProvider();

export function getDefaultImageProvider(): ImageProvider {
  return defaultProvider;
}

export function registerImageProvider(provider: ImageProvider): void {
  defaultProvider = provider;
  // eslint-disable-next-line no-console
  console.log(`[ImageProvider] 已注册: ${provider.name}`);
}

/** 一次性生成 3 张变体图 (串行，避免 API 限流) */
export async function generateThreeVariants(
  prompt: string,
  styleId: StylePresetId | undefined,
  baseSeed?: number,
): Promise<ImageVariant[]> {
  const provider = getDefaultImageProvider();
  const angles: Array<ImageVariant['angle']> = ['front_bust', 'side_bust', 'full_body'];
  const styleSuffix = getStylePromptSuffix(styleId);
  const fullPrompt = `${prompt}, ${styleSuffix}`;

  const results: Array<{ status: 'fulfilled' | 'rejected'; value?: ImageGenResult; reason?: any }> = [];

  for (let idx = 0; idx < angles.length; idx++) {
    try {
      const result = await provider.generate({
        prompt: fullPrompt,
        styleId,
        angle: angles[idx],
        seed: (baseSeed || hashStringToInt(prompt)) + idx,
      });
      results.push({ status: 'fulfilled', value: result });
    } catch (err) {
      results.push({ status: 'rejected', reason: err });
    }
    if (idx < angles.length - 1) {
      await new Promise(r => setTimeout(r, 15000));
    }
  }

  return results.map((r, idx) => {
    if (r.status === 'fulfilled' && r.value) {
      return {
        angle: angles[idx],
        url: r.value!.url,
        prompt: fullPrompt,
        seed: r.value!.seed,
        createdAt: Date.now(),
      };
    }
    // 失败时返回空 url
    return {
      angle: angles[idx],
      url: '',
      prompt: fullPrompt,
      createdAt: Date.now(),
    };
  });
}
