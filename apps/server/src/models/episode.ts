import { queryAll, queryOne, execute } from './db';
import { Episode } from '../shared/types';

export class EpisodeModel {
  async create(episode: Episode): Promise<void> {
    await execute(
      `INSERT INTO episodes (id, novel_id, episode_number, title, summary, duration_sec,
       scene_location, characters, script_content, script_format, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [episode.id, episode.novelId, episode.episodeNumber, episode.title, episode.summary || '',
       episode.durationSec, episode.sceneLocation || '', JSON.stringify(episode.characters),
       episode.scriptContent || '', episode.scriptFormat || '', episode.status, episode.createdAt, episode.updatedAt || Date.now()]
    );
  }

  async findByNovelId(novelId: string): Promise<Episode[]> {
    const rows = await queryAll<any>(
      'SELECT * FROM episodes WHERE novel_id = ? ORDER BY episode_number',
      [novelId]
    );
    return rows.map(row => this.mapRowToEpisode(row));
  }

  async findByNovelIdLight(novelId: string): Promise<any[]> {
    const rows = await queryAll<any>(
      `SELECT id, novel_id, episode_number, title, summary, duration_sec,
              scene_location, characters, script_format, status, created_at, updated_at,
              LENGTH(COALESCE(script_content, '')) AS char_count
       FROM episodes WHERE novel_id = ? ORDER BY episode_number`,
      [novelId]
    );
    return rows.map(row => ({
      id: row.id,
      novelId: row.novel_id,
      episodeNumber: row.episode_number,
      title: row.title,
      summary: row.summary,
      durationSec: row.duration_sec,
      sceneLocation: row.scene_location,
      characters: typeof row.characters === 'string' ? JSON.parse(row.characters || '[]') : (row.characters || []),
      scriptFormat: row.script_format,
      status: row.status,
      charCount: row.char_count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async deleteByNovelId(novelId: string): Promise<void> {
    await execute('DELETE FROM episodes WHERE novel_id = ?', [novelId]);
  }

  async findById(id: string): Promise<Episode | undefined> {
    const row = await queryOne<any>('SELECT * FROM episodes WHERE id = ?', [id]);
    if (!row) return undefined;
    return this.mapRowToEpisode(row);
  }

  async updateScript(id: string, scriptContent: string): Promise<void> {
    await execute(
      'UPDATE episodes SET script_content = ?, status = ?, updated_at = ? WHERE id = ?',
      [scriptContent, 'completed', Date.now(), id]
    );
  }

  async updateTitle(id: string, title: string): Promise<void> {
    await execute('UPDATE episodes SET title = ?, updated_at = ? WHERE id = ?', [title, Date.now(), id]);
  }

  async update(id: string, data: Partial<Episode>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.summary !== undefined) { fields.push('summary = ?'); values.push(data.summary); }
    if (data.durationSec !== undefined) { fields.push('duration_sec = ?'); values.push(data.durationSec); }
    if (data.sceneLocation !== undefined) { fields.push('scene_location = ?'); values.push(data.sceneLocation); }
    if (data.scriptContent !== undefined) { fields.push('script_content = ?'); values.push(data.scriptContent); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    fields.push('updated_at = ?'); values.push(Date.now());
    if (fields.length === 0) return;
    values.push(id);
    await execute(`UPDATE episodes SET ${fields.join(', ')} WHERE id = ?`, values);
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
      characters: typeof row.characters === 'string' ? JSON.parse(row.characters || '[]') : (row.characters || []),
      scriptContent: row.script_content,
      scriptFormat: row.script_format,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const episodeModel = new EpisodeModel();
