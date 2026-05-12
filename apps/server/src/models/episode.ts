import { getDb } from './db';
import { Episode } from '@ai-script/shared-types';

export class EpisodeModel {
  async create(episode: Episode): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO episodes (id, novel_id, episode_number, title, summary, duration_sec,
       scene_location, characters, script_content, script_format, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [episode.id, episode.novelId, episode.episodeNumber, episode.title, episode.summary,
       episode.durationSec, episode.sceneLocation, JSON.stringify(episode.characters),
       episode.scriptContent, episode.scriptFormat, episode.status, episode.createdAt]
    );
  }

  async findByNovelId(novelId: string): Promise<Episode[]> {
    const db = await getDb();
    const rows = await db.all(
      'SELECT * FROM episodes WHERE novel_id = ? ORDER BY episode_number',
      novelId
    );
    return rows.map(row => this.mapRowToEpisode(row));
  }

  async findById(id: string): Promise<Episode | undefined> {
    const db = await getDb();
    const row = await db.get('SELECT * FROM episodes WHERE id = ?', id);
    if (!row) return undefined;
    return this.mapRowToEpisode(row);
  }

  async updateScript(id: string, scriptContent: string): Promise<void> {
    const db = await getDb();
    await db.run(
      'UPDATE episodes SET script_content = ?, status = ? WHERE id = ?',
      [scriptContent, 'completed', id]
    );
  }

  private mapRowToEpisode(row: any): Episode {
    return {
      id: row.id,
      novelId: row.novel_id,
      episodeNumber: row.episode_number,
      title: row.title,
      summary: row.summary,
      durationSec: row.duration_sec,
      sceneLocation: row.scene_location,
      characters: JSON.parse(row.characters || '[]'),
      scriptContent: row.script_content,
      scriptFormat: row.script_format,
      status: row.status,
      createdAt: row.created_at,
    };
  }
}

export const episodeModel = new EpisodeModel();
