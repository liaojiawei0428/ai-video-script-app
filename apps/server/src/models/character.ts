import { queryAll, execute } from './db';
import { Character } from '../shared/types';

export class CharacterModel {
  async create(character: Character): Promise<void> {
    await execute(
      `INSERT INTO characters (id, novel_id, name, aliases, appearance, personality,
       role_type, relationships, reference_image, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [character.id, character.novelId, character.name, JSON.stringify(character.aliases),
       character.appearance || '', character.personality || '', character.roleType,
       JSON.stringify(character.relationships), character.referenceImage || '', character.createdAt]
    );
  }

  async findByNovelId(novelId: string): Promise<Character[]> {
    const rows = await queryAll<any>('SELECT * FROM characters WHERE novel_id = ?', [novelId]);
    return rows.map(row => this.mapRowToCharacter(row));
  }

  async bulkCreate(characters: Character[]): Promise<void> {
    for (const character of characters) {
      await this.create(character);
    }
  }

  private mapRowToCharacter(row: any): Character {
    return {
      id: row.id,
      novelId: row.novel_id,
      name: row.name,
      aliases: typeof row.aliases === 'string' ? JSON.parse(row.aliases || '[]') : (row.aliases || []),
      appearance: row.appearance,
      personality: row.personality,
      roleType: row.role_type,
      relationships: typeof row.relationships === 'string' ? JSON.parse(row.relationships || '[]') : (row.relationships || []),
      referenceImage: row.reference_image,
      createdAt: row.created_at,
    };
  }
}

export const characterModel = new CharacterModel();
