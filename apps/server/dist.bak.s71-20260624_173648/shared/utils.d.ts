export declare function generateUUID(): string;
export declare function formatDate(timestamp: number): string;
export declare function estimateDuration(content: string): number;
export declare function chunkText(text: string, chunkSize: number, overlap?: number): string[];
export declare function sanitizeFilename(filename: string): string;
export declare function sliceTextAtBoundary(text: string, start: number, end: number, overlap?: number): string;
export declare function estimateTokens(chineseChars: number): number;
export declare function estimateCost(inputTokens: number, outputTokens: number): number;
