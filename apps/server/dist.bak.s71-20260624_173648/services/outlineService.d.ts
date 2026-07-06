import type { EpisodeOutline, PlotGraph } from '../shared/types';
export declare class OutlineService {
    generateOutline(novelId: string): Promise<EpisodeOutline>;
    getOutline(novelId: string): Promise<EpisodeOutline | null>;
    confirmOutline(novelId: string): Promise<EpisodeOutline>;
    generatePlotGraph(novelId: string): Promise<PlotGraph>;
    getPlotGraph(novelId: string): Promise<PlotGraph | null>;
}
export declare const outlineService: OutlineService;
