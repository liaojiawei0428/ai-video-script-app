/**
 * 标准化角色生成 Prompt 构建器
 *
 * 输入: 角色数据 + 画风 ID + 模板级别 + 目标平台
 * 输出: 完整 prompt 字符串 + 负面 prompt + 平台参数
 *
 * 用法:
 *   const result = buildCharacterPrompt({
 *     character: characterData,
 *     styleId: 'hyperrealistic-cinematic',
 *     templateId: 'advanced',
 *     platform: 'midjourney',
 *     referenceImageUrl: 'https://...',
 *   });
 */

import * as fs from 'fs';
import * as path from 'path';
import { detectRole, extractSignalsFromDescription, type RoleType } from './role-detector';

export interface CharacterInput {
  id: string;
  name: string;
  description: string;
  extraDescription?: string;
  aliases?: string[];
  /** 由调用方预检测 (可选) */
  roleType?: RoleType;
}

export type TemplateId = 'basic' | 'advanced' | 'professional';
export type PlatformId = 'midjourney' | 'midjourney-v7' | 'stableDiffusion' | 'flux-dev' | 'flux-pro' | 'dalle3' | 'agnes';

export interface BuildPromptOptions {
  character: CharacterInput;
  styleId: string;
  templateId?: TemplateId;
  platform?: PlatformId;
  referenceImageUrl?: string;
  /** 自定义 style 字段覆盖 */
  styleOverrides?: Record<string, any>;
  /** 上下文 (如 novel era) */
  context?: {
    era?: string;
    genre?: string;
  };
}

export interface BuiltPrompt {
  prompt: string;
  negativePrompt: string;
  platformParams: string;
  metadata: {
    styleId: string;
    templateId: TemplateId;
    platform: PlatformId;
    detectedRole: RoleType;
    roleBoost: number;
    promptLength: number;
  };
}

// ---- 配置加载 ----

const PROMPTS_ROOT = path.resolve(__dirname, '..');
let _cache: { styles: Map<string, any>; templates: Map<TemplateId, any>; layers: any } | null = null;

function loadConfig() {
  if (_cache) return _cache;

  const styles = new Map<string, any>();
  const stylesDir = path.join(PROMPTS_ROOT, 'styles');
  for (const file of fs.readdirSync(stylesDir)) {
    if (file.endsWith('.json')) {
      const data = JSON.parse(fs.readFileSync(path.join(stylesDir, file), 'utf-8'));
      styles.set(data.styleId, data);
    }
  }

  const templates = new Map<TemplateId, any>();
  const templatesDir = path.join(PROMPTS_ROOT, 'templates');
  for (const file of fs.readdirSync(templatesDir)) {
    if (file.endsWith('.json')) {
      const data = JSON.parse(fs.readFileSync(path.join(templatesDir, file), 'utf-8'));
      templates.set(data.templateId, data);
    }
  }

  const layers = JSON.parse(
    fs.readFileSync(path.join(PROMPTS_ROOT, 'layers', 'layers.json'), 'utf-8')
  );

  _cache = { styles, templates, layers };
  return _cache;
}

// ---- 辅助: 关键词展开 ----

function pickKeywords(keywordList: string[], max: number): string {
  // 去重 + 取前 max 个
  const seen = new Set<string>();
  const result: string[] = [];
  for (const kw of keywordList) {
    const k = kw.toLowerCase().trim();
    if (!seen.has(k)) {
      seen.add(k);
      result.push(kw);
      if (result.length >= max) break;
    }
  }
  return result.join(', ');
}

function buildStyleLayer(style: any, ctx: { era?: string; genre?: string }): string {
  const kws = style.keywords || {};
  const parts: string[] = [];

  // subject
  if (kws.subject?.length) parts.push(pickKeywords(kws.subject, 4));

  // camera
  if (kws.camera?.length) parts.push(pickKeywords(kws.camera, 3));

  // lighting
  if (kws.lighting?.length) parts.push(pickKeywords(kws.lighting, 3));

  // film
  if (kws.film?.length) parts.push(pickKeywords(kws.film, 2));

  // color grading
  if (kws.colorGrading?.length) parts.push(pickKeywords(kws.colorGrading, 2));

  // context-based mood
  if (ctx.genre && style.moodMap?.[ctx.genre]) {
    parts.push(style.moodMap[ctx.genre]);
  }

  return parts.filter(Boolean).join(', ');
}

function buildNegativePrompt(style: any, template: any): string {
  const styleNeg = style.negativePrompt || style.keywords?.negative?.join(', ') || '';
  const tmplNeg = template.negativePrompt?.autoInclude?.join(', ') || '';
  const combined = `${styleNeg}, ${tmplNeg}`.split(',').map(s => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const item of combined) {
    const k = item.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(item);
    }
  }
  return unique.join(', ');
}

// ---- L1 核心主体层构建 ----

function buildL1Core(character: CharacterInput, role: RoleType, tmpl: any): string {
  const fullDesc = `${character.description || ''} ${character.extraDescription || ''}`.trim();
  const descLength = fullDesc.length;
  const boostFactor = role === 'protagonist' ? 1.0 : role === 'supporting' ? 0.6 : 0.3;

  // 截取合适长度的描述 (按角色类型)
  const maxLen = Math.floor(800 * boostFactor);
  const trimmedDesc = fullDesc.length > maxLen
    ? fullDesc.slice(0, maxLen) + '...'
    : fullDesc;

  // 简化: 主角/配角直接拼接描述 (不强拆字段)
  if (tmpl.templateId === 'basic') {
    return `${character.name}, ${role}, ${trimmedDesc.split('\n')[0] || ''}`;
  }

  // advanced / professional: 拼接完整描述
  return `${character.name} (${role}), ${trimmedDesc.replace(/\n+/g, ' | ')}`;
}

// ---- L3 技术参数层 ----

function buildL3Technical(style: any, tmpl: any, templateLevel: TemplateId): string {
  if (templateLevel === 'basic') {
    return `${pickKeywords(style.keywords?.subject || [], 3)}, 8k, high quality, detailed`;
  }

  // 提取 style 默认 lighting/camera (hyperrealistic 才有, ink-wash 不需要)
  const camera = style.keywords?.camera || [];
  const lighting = style.keywords?.lighting || [];
  const parts: string[] = [];

  if (camera.length) parts.push(pickKeywords(camera, 3));
  if (lighting.length) parts.push(pickKeywords(lighting, 3));
  parts.push('8k, ultra-detailed, masterpiece');

  return parts.join(', ');
}

// ---- L4 平台参数 ----

function buildL4Platform(platform: PlatformId, template: any, refUrl?: string): string {
  if (platform === 'agnes') {
    return refUrl ? `image_url: ${refUrl}` : '';
  }

  let baseParams: string = '';
  if (template.layers?.L4_platform?.platformPresets?.[platform]) {
    baseParams = template.layers.L4_platform.platformPresets[platform];
  } else if (template.layers?.L4_platform?.defaults) {
    baseParams = template.layers.L4_platform.defaults[platform] || '';
  }

  if (refUrl && baseParams.includes('{ref_url}')) {
    baseParams = baseParams.replace('{ref_url}', refUrl);
  }

  return baseParams;
}

// ---- 主角 ----

export function buildCharacterPrompt(options: BuildPromptOptions): BuiltPrompt {
  const {
    character,
    styleId,
    templateId = 'advanced',
    platform = 'midjourney',
    referenceImageUrl,
    styleOverrides,
    context = {},
  } = options;

  const config = loadConfig();
  const style = config.styles.get(styleId);
  if (!style) {
    throw new Error(`Unknown styleId: ${styleId}. Available: ${[...config.styles.keys()].join(', ')}`);
  }
  const template = config.templates.get(templateId);
  if (!template) {
    throw new Error(`Unknown templateId: ${templateId}. Available: ${[...config.templates.keys()].join(', ')}`);
  }

  // 1. 角色类型检测
  const signals = extractSignalsFromDescription(character.description);
  const detection = character.roleType
    ? { role: character.roleType, confidence: 1, signals, boostFactor: character.roleType === 'protagonist' ? 1.5 : character.roleType === 'supporting' ? 1.2 : 0.8 }
    : detectRole(signals);

  // 2. 构建四层
  const l1 = buildL1Core(character, detection.role, template);
  const l2 = buildStyleLayer(style, context);
  const l3 = buildL3Technical(style, template, templateId);
  const l4 = buildL4Platform(platform, template, referenceImageUrl);

  // 3. 应用 style 覆盖
  const finalL2 = styleOverrides?.L2_style || l2;

  // 4. 拼接
  const separator = template.separator || ' || ';
  const promptTemplate = template.promptTemplate || '{L1_core} || {L2_style} || {L3_technical} || {L4_platform}';

  let prompt = promptTemplate
    .replace('{L1_core}', l1)
    .replace('{L2_style}', finalL2)
    .replace('{L3_technical}', l3)
    .replace('{L4_platform}', l4);

  // 5. 负面 prompt
  const negativePrompt = buildNegativePrompt(style, template);

  // 6. 质量闸门
  if (prompt.length < 50) {
    console.warn(`[prompt-builder] Prompt length ${prompt.length} is below minimum 50, may produce poor results`);
  }
  if (prompt.length > 2000 && platform !== 'midjourney') {
    prompt = prompt.slice(0, 2000) + '...';
  }

  return {
    prompt,
    negativePrompt,
    platformParams: l4,
    metadata: {
      styleId,
      templateId,
      platform,
      detectedRole: detection.role,
      roleBoost: detection.boostFactor,
      promptLength: prompt.length,
    },
  };
}

// ---- 便捷 API ----

/**
 * 列出所有可用画风
 */
export function listStyles() {
  const config = loadConfig();
  return [...config.styles.values()].map(s => ({
    styleId: s.styleId,
    name: s.name,
    description: s.description,
    category: s.category,
  }));
}

/**
 * 列出所有可用模板
 */
export function listTemplates() {
  const config = loadConfig();
  return [...config.templates.values()].map(t => ({
    templateId: t.templateId,
    name: t.name,
    description: t.description,
    level: t.level,
  }));
}

/**
 * 列出所有可用平台
 */
export function listPlatforms(): PlatformId[] {
  return ['midjourney', 'midjourney-v7', 'stableDiffusion', 'flux-dev', 'flux-pro', 'dalle3', 'agnes'];
}
