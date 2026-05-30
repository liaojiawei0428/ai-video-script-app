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

  async update(id: string, data: Partial<Character>): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [];
    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
    if (data.appearance !== undefined) { sets.push('appearance = ?'); params.push(data.appearance); }
    if (data.personality !== undefined) { sets.push('personality = ?'); params.push(data.personality); }
    if (data.roleType !== undefined) { sets.push('role_type = ?'); params.push(data.roleType); }
    if (sets.length === 0) return;
    params.push(id);
    await execute(`UPDATE characters SET ${sets.join(', ')} WHERE id = ?`, params);
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
