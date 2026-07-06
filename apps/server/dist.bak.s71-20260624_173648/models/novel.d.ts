import { Novel } from '../shared/types';
export declare class NovelModel {
    create(novel: Novel): Promise<void>;
    findByUserId(userId: string, opts?: {
        q?: string;
        status?: string;
    }): Promise<Novel[]>;
    findById(id: string): Promise<Novel | undefined>;
    updateStatus(id: string, status: Novel['status']): Promise<void>;
    updateAnalysis(id: string, analysis: Partial<Novel>): Promise<void>;
    updateFullSummary(id: string, fullSummary: string): Promise<void>;
    updateAnalysisReport(id: string, analysisReport: string): Promise<void>;
    list(): Promise<Novel[]>;
    findManyByStatus(statuses: string[]): Promise<Novel[]>;
    updateOutline(id: string, outlineText: string): Promise<void>;
    confirmOutline(id: string, outlineText: string): Promise<void>;
    updatePlotGraph(id: string, plotGraph: string): Promise<void>;
    private mapRowToNovel;
}
export declare const novelModel: NovelModel;
