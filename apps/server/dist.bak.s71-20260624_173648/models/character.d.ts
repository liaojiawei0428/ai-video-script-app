import { Character } from '../shared/types';
export declare class CharacterModel {
    create(character: Character): Promise<void>;
    findById(id: string): Promise<Character | undefined>;
    findByNovelId(novelId: string): Promise<Character[]>;
    bulkCreate(characters: Character[]): Promise<void>;
    update(id: string, data: Partial<Character>): Promise<void>;
    /**
     * v2.5.11: 全字段更新 (含 description/extra_description JSON)
     * 用户在 Web 端编辑后保存使用
     * 同时: confirmed 保留, image_gen_status 保留 (避免破坏已生成图)
     */
    updateFull(id: string, data: {
        name?: string;
        aliases?: string[];
        appearance?: string;
        personality?: string;
        roleType?: string;
        description?: string;
        extraDescription?: string;
    }): Promise<void>;
    private mapRowToCharacter;
}
export declare const characterModel: CharacterModel;
