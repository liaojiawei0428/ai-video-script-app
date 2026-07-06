import { Chunk, ChunkSummary, ChunkProgress } from '../shared/types';
export declare class ChunkService {
    /**
     * 按章节/段落边界将小说分块
     */
    splitIntoChunks(content: string, maxChunkSize?: number): Chunk[];
    /**
     * 逐块分析（并行执行，每块最多 3 次重试）
     */
    analyzeAllChunks(chunks: Chunk[], novelId: string, onProgress: (progress: ChunkProgress) => void, styleBibleBlock?: string): Promise<ChunkSummary[]>;
    /**
     * 一次性合并所有块摘要为全文摘要
     */
    mergeSummaries(summaries: ChunkSummary[], novelId?: string, styleBibleBlock?: string): Promise<string>;
    private emitProgress;
    private sleep;
}
export declare const chunkService: ChunkService;
