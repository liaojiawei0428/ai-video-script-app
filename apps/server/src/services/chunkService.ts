import { deepseekPool } from './deepseekPool';
import { billingService } from './billingService';
import { websocketService } from './websocket';
import {
  chunkAnalysisSystemPrompt,
  chunkAnalysisUserPrompt,
} from '../prompts/chunkAnalysis';
import {
  chunkMergeSystemPrompt,
  chunkMergeUserPrompt,
} from '../prompts/chunkMerge';
import { Chunk, ChunkSummary, ChunkStatus, ChunkProgress } from '../shared/types';
import { logger } from '../utils/logger';
import { NovelService } from './novelService';

const MAX_CHUNK_SIZE = 400000;
const OVERLAP_CHARS = 300;
const MAX_CONCURRENT = parseInt(process.env.CHUNK_CONCURRENT || '10', 10);
const MAX_RETRIES = 3;

export class ChunkService {
  /**
   * 按章节/段落边界将小说分块
   */
  splitIntoChunks(content: string, maxChunkSize: number = MAX_CHUNK_SIZE): Chunk[] {
    if (content.length <= maxChunkSize) {
      return [{
        index: 1,
        content,
        startChar: 0,
        endChar: content.length,
      }];
    }

    const chunks: Chunk[] = [];
    let startIdx = 0;
    let chunkIndex = 1;

    while (startIdx < content.length) {
      let endIdx = Math.min(startIdx + maxChunkSize, content.length);

      if (endIdx < content.length) {
        // 在目标结束位置附近找自然断点
        const searchStart = Math.max(startIdx + Math.floor(maxChunkSize * 0.8), startIdx + 1);
        const searchEnd = Math.min(endIdx + 5000, content.length);
        const searchZone = content.slice(searchStart, searchEnd);

        // 优先级1：章节边界
        const chapterMatch = searchZone.match(/(?:第[一二三四五六七八九十百千\d]+[章节回部卷]|Chapter\s+\d+|第\d+章)/);
        if (chapterMatch && searchStart + chapterMatch.index! > startIdx + maxChunkSize - 20000) {
          const chapterPos = searchStart + chapterMatch.index!;
          // 找到章节标题前的换行
          const beforeChapter = content.lastIndexOf('\n\n', chapterPos);
          endIdx = beforeChapter > startIdx ? beforeChapter + 2 : chapterPos;
        } else {
          // 优先级2：段落边界（双换行）
          const searchSegment = content.slice(endIdx - 2000, endIdx + 1000);
          const paraBreak = searchSegment.lastIndexOf('\n\n');
          if (paraBreak > 500 && paraBreak < searchSegment.length - 100) {
            endIdx = endIdx - 2000 + paraBreak;
          } else {
            // 优先级3：单换行
            const lineBreak = searchSegment.lastIndexOf('\n');
            if (lineBreak > 500 && lineBreak < searchSegment.length - 50) {
              endIdx = endIdx - 2000 + lineBreak;
            }
          }
        }
      }

      // 确保不会超过总长度
      endIdx = Math.min(endIdx, content.length);
      // 确保块不为空且不倒退
      if (endIdx <= startIdx) {
        endIdx = Math.min(startIdx + maxChunkSize, content.length);
      }

      chunks.push({
        index: chunkIndex,
        content: content.slice(startIdx, endIdx),
        startChar: startIdx,
        endChar: endIdx,
      });

      // 下一块从当前块末尾往前偏移重叠字符数
      startIdx = endIdx > startIdx ? endIdx : endIdx + 1;
      // 如果有重叠，下一块从 endIdx - OVERLAP_CHARS 开始
      if (endIdx < content.length && OVERLAP_CHARS > 0) {
        startIdx = Math.max(startIdx - OVERLAP_CHARS, endIdx - OVERLAP_CHARS);
      }
      chunkIndex++;
    }

    logger.info('Chunking completed', {
      totalChars: content.length,
      chunkCount: chunks.length,
      avgChunkSize: Math.round(content.length / chunks.length),
    });

    return chunks;
  }

  /**
   * 逐块分析（并行执行，每块最多 3 次重试）
   */
  async analyzeAllChunks(
    chunks: Chunk[],
    novelId: string,
    onProgress: (progress: ChunkProgress) => void,
    styleBibleBlock?: string,
  ): Promise<ChunkSummary[]> {
    const total = chunks.length;
    const chunkStates: ChunkStatus[] = chunks.map(c => ({
      index: c.index,
      status: 'pending' as const,
    }));
    const summaries: ChunkSummary[] = [];
    let completedCount = 0;
    const chunkTimestamps: number[] = [];

    // 初始化进度
    this.emitProgress(novelId, 0, total, 'analyzing_chunks', chunkStates, onProgress, chunkTimestamps);

    // 使用信号量控制并发
    const runChunk = async (chunk: Chunk): Promise<void> => {
      const state = chunkStates[chunk.index - 1];
      const chunkStartTime = Date.now();
      state.status = 'running';
      this.emitProgress(novelId, completedCount, total, 'analyzing_chunks', chunkStates, onProgress, chunkTimestamps);

      let lastError = '';
      let success = false;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // 每次尝试前检查是否已被用户取消
        if (NovelService.isCancelled(novelId)) {
          logger.info('Chunk analysis cancelled by user', { novelId, chunkIndex: chunk.index });
          state.status = 'failed';
          state.error = '任务已被用户取消';
          completedCount++;
          return;
        }
        try {
          let chunkContent = '';
          await deepseekPool.chatCompletionStreamWithMessages(
            [
              { role: 'system', content: chunkAnalysisSystemPrompt(styleBibleBlock) },
              { role: 'user', content: chunkAnalysisUserPrompt(chunk.content, styleBibleBlock) },
            ],
            (token) => {
              if (NovelService.isCancelled(novelId)) {
                throw new Error('CANCELLED_BY_USER');
              }
              chunkContent += token;
              websocketService.broadcastChunkStream(novelId, chunk.index, token);
            },
            0.3
          );

          summaries.push({
            index: chunk.index,
            content: chunkContent,
          });
          state.status = 'completed';
          success = true;
          completedCount++;
          chunkTimestamps.push(Date.now() - chunkStartTime);

          // 每块完成后广播 progress 让进度条真实推进
          const pct = 3 + Math.floor((completedCount / total) * 72);
          websocketService.broadcastProgress(novelId, pct, 'analyzing');

          logger.info('Chunk analysis completed', {
            chunkIndex: chunk.index,
            total: chunks.length,
            attempt,
            outputLength: chunkContent.length,
          });
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          if (lastError.includes('CANCELLED_BY_USER')) {
            logger.info('Chunk analysis aborted by user cancel', { chunkIndex: chunk.index });
            break;
          }
          logger.warn('Chunk analysis failed, retrying', {
            chunkIndex: chunk.index,
            attempt,
            maxRetries: MAX_RETRIES,
            error: lastError,
          });
          if (attempt < MAX_RETRIES) {
            await this.sleep(Math.pow(2, attempt) * 1000);
          }
        }
      }

      if (!success) {
        state.status = 'failed';
        state.error = lastError;
        summaries.push({
          index: chunk.index,
          content: '',
          failed: true,
          error: lastError,
        });
        completedCount++;
        chunkTimestamps.push(Date.now() - chunkStartTime);
        logger.error('Chunk analysis exhausted retries', {
          chunkIndex: chunk.index,
          error: lastError,
        });
      }

      this.emitProgress(novelId, completedCount, total, 'analyzing_chunks', chunkStates, onProgress, chunkTimestamps);
    };

    // 并发执行
    const queue = [...chunks];
    const running: Promise<void>[] = [];

    while (queue.length > 0 || running.length > 0) {
      while (running.length < MAX_CONCURRENT && queue.length > 0) {
        const chunk = queue.shift()!;
        running.push(runChunk(chunk));
      }

      if (running.length > 0) {
        await Promise.race(running);
        // 清理已完成的 promise
        for (let i = running.length - 1; i >= 0; i--) {
          const p = running[i];
          // 检查是否已完成（通过 Promise.race 判断）
          const isSettled = await Promise.race([
            p.then(() => true).catch(() => true),
            this.sleep(0).then(() => false),
          ]);
          if (isSettled) {
            running.splice(i, 1);
          }
        }
      }
    }

    logger.info('All chunks analyzed', {
      total,
      completed: summaries.length,
      failed: summaries.filter(s => s.failed).length,
    });

    return summaries;
  }

  /**
   * 一次性合并所有块摘要为全文摘要
   */
  async mergeSummaries(summaries: ChunkSummary[], novelId?: string, styleBibleBlock?: string): Promise<string> {
    const sorted = [...summaries].sort((a, b) => a.index - b.index);

    const validSummaries = sorted.filter(s => !s.failed && s.content);
    const failedSummaries = sorted.filter(s => s.failed);

    if (validSummaries.length === 0) {
      logger.warn('All chunk analyses failed, returning empty summary', {
        totalChunks: sorted.length,
        failedCount: failedSummaries.length,
        errors: failedSummaries.slice(0, 3).map(s => s.error),
      });
      return `（分析异常：${sorted.length} 个段落全部分析失败，可能因 API 连接不稳定导致，请稍后重新分析。）`;
    }

    const failedNote = failedSummaries.length > 0
      ? `\n\n注意：以下段落分析失败，无数据：第 ${failedSummaries.map(s => s.index).join('、')} 段`
      : '';

    const summariesText = validSummaries
      .map(s => `【第 ${s.index} 段摘要】\n${s.content}`)
      .join('\n\n---\n\n') + failedNote;

    logger.info('Merging summaries', {
      totalCount: sorted.length,
      validCount: validSummaries.length,
      failedCount: failedSummaries.length,
      totalChars: summariesText.length,
    });

    try {
      if (novelId) {
        // 计费统一在 novelService 中进行
      }
      const result = await deepseekPool.chatCompletion(
        chunkMergeSystemPrompt(styleBibleBlock),
        chunkMergeUserPrompt(summariesText, styleBibleBlock),
        0.3
      );

      logger.info('Summaries merged', {
        outputLength: result.content.length,
        tokens: result.totalTokens,
      });

      return result.content;
    } catch (mergeError) {
      logger.error('Merge summaries failed, returning partial result', {
        error: mergeError instanceof Error ? mergeError.message : String(mergeError),
        validCount: validSummaries.length,
      });
      return validSummaries.map(s => s.content).join('\n\n---\n\n') +
        '\n\n（合并阶段失败，以上为各段直接摘要。）';
    }
  }

  private emitProgress(
    novelId: string,
    current: number,
    total: number,
    phase: ChunkProgress['phase'],
    chunkStates: ChunkStatus[],
    onProgress: (p: ChunkProgress) => void,
    chunkTimestamps?: number[]
  ): void {
    let eta: number | undefined;
    if (chunkTimestamps && chunkTimestamps.length > 0 && current < total) {
      const avgMs = chunkTimestamps.reduce((a, b) => a + b, 0) / chunkTimestamps.length;
      const remaining = total - current;
      eta = Math.round((avgMs * remaining) / 1000);
    }
    const progress: ChunkProgress = {
      phase,
      current,
      total,
      unitLabel: '段',
      detail: current >= total
        ? '全部段落分析完毕'
        : `正在分析第 ${current + 1}/${total} 段...`,
      chunkStates: chunkStates.map(s => ({ ...s })),
      eta,
    };
    onProgress(progress);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const chunkService = new ChunkService();
