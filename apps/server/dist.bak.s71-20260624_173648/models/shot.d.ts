import { Shot } from '../shared/types';
export declare class ShotModel {
    create(shot: Shot): Promise<void>;
    findByEpisodeId(episodeId: string): Promise<Shot[]>;
    findById(id: string): Promise<Shot | undefined>;
    update(id: string, data: Partial<Shot>): Promise<void>;
    bulkCreate(shots: Shot[]): Promise<void>;
    private mapRowToShot;
}
export declare const shotModel: ShotModel;
