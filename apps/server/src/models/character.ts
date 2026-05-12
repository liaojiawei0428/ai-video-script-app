import { getDb } from './db';
import { Character } from '@ai-script/shared-types';

export class CharacterModel {
  async create(character: Character): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO characters (id, novel_id, name, aliases, appearance, personality,
       role_type, relationships, reference_image, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [character.id, character.novelId, character.name, JSON.stringify(character.aliases),
       character.appearance, character.personality, character.roleType,
       JSON.stringify(character.relationships), character.referenceImage, character.createdAt]
    );
  }

  async findByNovelId(novelId: string): Promise<Character[]> {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM characters WHERE novel_id = ?', novelId);
    return rows.map(row => this.mapRowToCharacter(row));
  }

  async bulkCreate(characters: Character[]): Promise<void> {
    const db = await getDb();
    const stmt = await db.prepare(
      `INSERT INTO characters (id, novel_id, name, aliases, appearance, personality,
       role_type, relationships, reference_image, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const character of characters) {
      await stmt.run(
        character.id, character.novelId, character.name, JSON.stringify(character.aliases),
        character.appearance, character.personality, character.roleType,
        JSON.stringify(character.relationships), character.referenceImage, character.createdAt
      );
    }

    await stmt.finalize();
  }

  private mapRowToCharacter(row: any): Character {
    return {
      id: row.id,
      novelId: row.novel_id,
      name: row.name,
      aliases: JSON.parse(row.aliases || '[]'),
      appearance: row.appearance,
      personality: row.personality,
      roleType: row.role_type,
      relationships: JSON.parse(row.relationships || '[]'),
      referenceImage: row.reference_image,
      createdAt: row.created_at,
    };
  }
}

export const characterModel = new CharacterModel();
