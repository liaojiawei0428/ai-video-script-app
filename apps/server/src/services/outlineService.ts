/**
 * v2.0.0 - 大纲 + 事件图谱 service
 */
import fs from 'fs/promises';
import path from 'path';
import iconv from 'iconv-lite';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { config } from '../config';
import { generateUUID } from '../shared/utils';
import { deepseekPool } from './deepseekPool';
import { novelModel } from '../models/novel';
import { characterModel } from '../models/character';
import { STYLE_PRESET_LIST } from '../shared/stylePresets';
import {
  buildEpisodeOutlineUserPrompt,
  episodeOutlineSystemPrompt,
} from '../prompts/episodeOutline';
import {
  buildPlotGraphUserPrompt,
  plotGraphSystemPrompt,
} from '../prompts/plotGraph';
import { buildStyleAnchorPrefix } from './styleBible';
import type { EpisodeOutline, PlotGraph } from '../shared/types';

function calcTargetEpisodes(totalChars: number): number {
  return Math.max(8, Math.min(20, Math.floor(totalChars / 3500)));
}

function safeJsonParse<T>(text: string): T {
  // 兼容 ```json ... ``` 包裹
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = m ? m[1].trim() : text.trim();
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    // 尝试去掉末尾逗号等
    const cleaned = raw.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(cleaned) as T;
  }
}

export class OutlineService {
  async generateOutline(novelId: string, userId?: string): Promise<EpisodeOutline> {
    const novel = await novelModel.findById(novelId);
    if (!novel?.filePath) throw new AppError('NOVEL_NOT_FOUND', 'Novel not found or no content', 404);

    const raw = await fs.readFile(novel.filePath);
    let content = iconv.decode(raw, 'utf-8');
    if (content.includes('\uFFFD')) content = iconv.decode(raw, 'gbk');

    const characters = await characterModel.findByNovelId(novelId);
    const style = STYLE_PRESET_LIST.find(s => s.id === ((novel as any).styleId || 'realistic')) || STYLE_PRESET_LIST[0];
    const styleBibleBlock = (novel as any).styleBible ? buildStyleAnchorPrefix((novel as any).styleBible, 'zh') : undefined;

    const target = calcTargetEpisodes(novel.totalChars);
    const userPrompt = buildEpisodeOutlineUserPrompt({
      novelTitle: novel.title,
      totalChars: novel.totalChars,
      styleName: style.name,
      characters: characters.map(c => ({ name: c.name, role: c.role || '?', description: (c as any).description })),
      fullContent: content,
      styleBibleBlock,
    }) + `\n\n请严格输出 ${target} 集大纲。`;

    logger.info('OutlineService.generateOutline start', { novelId, userId, target, charCount: characters.length });
    const result = await deepseekPool.chatCompletionWithRetry(
      episodeOutlineSystemPrompt(styleBibleBlock),
      userPrompt,
      0.7,
      2,
      userId,
    );
    const parsed = safeJsonParse<{ items: EpisodeOutline['items'] }>(result.content);
    if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      throw new AppError('LLM_INVALID_OUTPUT', 'AI 返回的大纲格式无效', 500);
    }

    const outline: EpisodeOutline = {
      novelId,
      items: parsed.items,
      generatedAt: Date.now(),
    };
    await novelModel.updateOutline(novelId, JSON.stringify(outline));
    logger.info('OutlineService.generateOutline done', { novelId, itemCount: outline.items.length });
    return outline;
  }

  async getOutline(novelId: string): Promise<EpisodeOutline | null> {
    const novel = await novelModel.findById(novelId);
    if (!novel) return null;
    const raw = (novel as any).outlineText;
    if (!raw) return null;
    try { return JSON.parse(raw) as EpisodeOutline; } catch { return null; }
  }

  async confirmOutline(novelId: string): Promise<EpisodeOutline> {
    const outline = await this.getOutline(novelId);
    if (!outline) throw new AppError('OUTLINE_NOT_FOUND', '请先生成大纲', 404);
    outline.confirmedAt = Date.now();
    await novelModel.confirmOutline(novelId, JSON.stringify(outline));
    return outline;
  }

  async generatePlotGraph(novelId: string, userId?: string): Promise<PlotGraph> {
    const novel = await novelModel.findById(novelId);
    if (!novel?.filePath) throw new AppError('NOVEL_NOT_FOUND', 'Novel not found or no content', 404);

    const raw = await fs.readFile(novel.filePath);
    let content = iconv.decode(raw, 'utf-8');
    if (content.includes('\uFFFD')) content = iconv.decode(raw, 'gbk');

    const characters = await characterModel.findByNovelId(novelId);
    const styleBibleBlock = (novel as any).styleBible ? buildStyleAnchorPrefix((novel as any).styleBible, 'zh') : undefined;
    const userPrompt = buildPlotGraphUserPrompt({
      novelTitle: novel.title,
      totalChars: novel.totalChars,
      characters: characters.map(c => ({ name: c.name, role: c.role || '?' })),
      fullContent: content,
      styleBibleBlock,
    });

    logger.info('OutlineService.generatePlotGraph start', { novelId, userId, charCount: characters.length });
    const result = await deepseekPool.chatCompletionWithRetry(
      plotGraphSystemPrompt(styleBibleBlock),
      userPrompt,
      0.6,
      2,
      userId,
    );
    const parsed = safeJsonParse<{ chapters: PlotGraph['chapters'] }>(result.content);
    if (!parsed.chapters || !Array.isArray(parsed.chapters) || parsed.chapters.length === 0) {
      throw new AppError('LLM_INVALID_OUTPUT', 'AI 返回的事件图谱格式无效', 500);
    }

    const graph: PlotGraph = {
      chapters: parsed.chapters,
      generatedAt: Date.now(),
    };
    await novelModel.updatePlotGraph(novelId, JSON.stringify(graph));
    logger.info('OutlineService.generatePlotGraph done', { novelId, chapterCount: graph.chapters.length });
    return graph;
  }

  async getPlotGraph(novelId: string): Promise<PlotGraph | null> {
    const novel = await novelModel.findById(novelId);
    if (!novel) return null;
    const raw = (novel as any).plotGraph;
    if (!raw) return null;
    try { return JSON.parse(raw) as PlotGraph; } catch { return null; }
  }
}

export const outlineService = new OutlineService();
