import { Episode } from '../shared/types';
export declare class EpisodeModel {
    create(episode: Episode): Promise<void>;
    findByNovelId(novelId: string): Promise<Episode[]>;
    findByNovelIdLight(novelId: string): Promise<any[]>;
    deleteByNovelId(novelId: string): Promise<void>;
    findById(id: string): Promise<Episode | undefined>;
    updateScript(id: string, scriptContent: string): Promise<void>;
    updateTitle(id: string, title: string): Promise<void>;
    update(id: string, data: Partial<Episode>): Promise<void>;
    private mapRowToEpisode;
}
export declare const episodeModel: EpisodeModel;
