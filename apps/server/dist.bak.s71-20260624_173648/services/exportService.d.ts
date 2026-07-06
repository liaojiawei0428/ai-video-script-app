export declare class ExportService {
    exportEpisode(episodeId: string, format: 'pdf' | 'docx', baseUrl: string): Promise<{
        filename: string;
        url: string;
        sizeBytes: number;
        expiresAt: number;
    }>;
    cleanupExpired(): Promise<number>;
}
export declare const exportService: ExportService;
